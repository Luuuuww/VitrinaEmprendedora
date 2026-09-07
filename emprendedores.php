<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

function ensureRatingTable(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS emprendimiento_calificaciones (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          emprendimiento_id INT UNSIGNED NOT NULL,
          votante_hash CHAR(64) NOT NULL,
          calificacion TINYINT UNSIGNED NOT NULL,
          creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_voto_emprendimiento (emprendimiento_id, votante_hash),
          FOREIGN KEY (emprendimiento_id) REFERENCES emprendedores(id) ON DELETE CASCADE
        )'
    );
}

function getVisitorHash(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $language = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';

    return hash('sha256', $ip . '|' . $userAgent . '|' . $language);
}

function visitorHasRated(int $emprendimientoId): bool
{
    $stmt = db()->prepare(
        'SELECT 1 FROM emprendimiento_calificaciones
         WHERE emprendimiento_id = ? AND votante_hash = ?
         LIMIT 1'
    );
    $stmt->execute([$emprendimientoId, getVisitorHash()]);

    return (bool)$stmt->fetchColumn();
}

function formatEmprendimiento(array $row, array $especialidades, array $fotos): array
{
    $id = (int)$row['id'];

    return [
        'id' => $id,
        'nombre' => $row['nombre'],
        'negocio' => $row['negocio'],
        'categoria' => $row['categoria'],
        'descripcion' => $row['descripcion'],
        'detalle' => $row['detalle'],
        'calificacion' => round((float)$row['calificacion'], 1),
        'totalCalificaciones' => (int)$row['total_resenas'],
        'calificadoPorEsteVisitante' => visitorHasRated($id),
        'telefono' => $row['telefono'],
        'email' => $row['email'],
        'ubicacion' => $row['ubicacion'],
        'imagen' => $row['imagen'],
        'horarios' => $row['horarios'],
        'redesSociales' => [
            'instagram' => $row['instagram'],
            'facebook' => $row['facebook'],
        ],
        'especialidades' => $especialidades,
        'fotos' => $fotos,
    ];
}

function getEmprendimiento(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM emprendedores WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    $specialties = db()->prepare('SELECT nombre FROM emprendimiento_especialidades WHERE emprendimiento_id = ? ORDER BY orden, id');
    $specialties->execute([$id]);
    $especialidades = array_column($specialties->fetchAll(), 'nombre');

    $photos = db()->prepare('SELECT url FROM emprendimiento_fotos WHERE emprendimiento_id = ? ORDER BY orden, id');
    $photos->execute([$id]);
    $fotos = array_column($photos->fetchAll(), 'url');

    return formatEmprendimiento($row, $especialidades, $fotos);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    ensureRatingTable();

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if ($id > 0) {
        $item = getEmprendimiento($id);
        if (!$item) {
            jsonResponse(['ok' => false, 'error' => 'Emprendimiento no encontrado'], 404);
        }
        jsonResponse(['ok' => true, 'emprendimiento' => $item]);
    }

    $ids = db()->query('SELECT id FROM emprendedores ORDER BY id')->fetchAll();
    $items = array_map(fn ($row) => getEmprendimiento((int)$row['id']), $ids);
    jsonResponse(['ok' => true, 'emprendedores' => $items]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['action'] ?? '') === 'calificar') {
    ensureRatingTable();

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $data = readJson();
    $calificacion = (int)($data['calificacion'] ?? 0);

    if ($id <= 0 || !getEmprendimiento($id)) {
        jsonResponse(['ok' => false, 'error' => 'Emprendimiento no encontrado'], 404);
    }

    if ($calificacion < 1 || $calificacion > 5) {
        jsonResponse(['ok' => false, 'error' => 'Calificacion invalida'], 422);
    }

    $pdo = db();
    $votanteHash = getVisitorHash();
    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO emprendimiento_calificaciones (emprendimiento_id, votante_hash, calificacion)
             VALUES (?, ?, ?)'
        );
        $stmt->execute([$id, $votanteHash, $calificacion]);

        $summary = $pdo->prepare(
            'SELECT ROUND(AVG(calificacion), 1) AS promedio, COUNT(*) AS total
             FROM emprendimiento_calificaciones
             WHERE emprendimiento_id = ?'
        );
        $summary->execute([$id]);
        $result = $summary->fetch();

        $update = $pdo->prepare('UPDATE emprendedores SET calificacion = ?, total_resenas = ? WHERE id = ?');
        $update->execute([(float)$result['promedio'], (int)$result['total'], $id]);

        $pdo->commit();
    } catch (PDOException $error) {
        $pdo->rollBack();
        if ($error->getCode() === '23000') {
            jsonResponse(['ok' => false, 'error' => 'Este dispositivo ya califico este emprendimiento'], 409);
        }
        jsonResponse(['ok' => false, 'error' => 'No se pudo guardar la calificacion'], 500);
    } catch (Throwable $error) {
        $pdo->rollBack();
        jsonResponse(['ok' => false, 'error' => 'No se pudo guardar la calificacion'], 500);
    }

    jsonResponse(['ok' => true, 'emprendimiento' => getEmprendimiento($id)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    ensureRatingTable();
    requireLogin();

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $allowedId = (int)($_SESSION['emprendimiento_id'] ?? 0);

    if ($id <= 0 || $id !== $allowedId) {
        jsonResponse(['ok' => false, 'error' => 'No autorizado para editar este emprendimiento'], 403);
    }

    $data = readJson();
    $redes = is_array($data['redesSociales'] ?? null) ? $data['redesSociales'] : [];
    $especialidades = array_values(array_filter($data['especialidades'] ?? [], fn ($item) => trim((string)$item) !== ''));
    $fotos = array_values(array_filter($data['fotos'] ?? [], fn ($item) => trim((string)$item) !== ''));
    $imagen = trim((string)($data['imagen'] ?? '')) ?: ($fotos[0] ?? '');

    $pdo = db();
    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'UPDATE emprendedores
             SET nombre = ?, negocio = ?, categoria = ?, descripcion = ?, detalle = ?,
                 telefono = ?, email = ?, ubicacion = ?, imagen = ?, horarios = ?,
                 instagram = ?, facebook = ?
             WHERE id = ?'
        );

        $stmt->execute([
            trim((string)($data['nombre'] ?? '')),
            trim((string)($data['negocio'] ?? '')),
            trim((string)($data['categoria'] ?? '')),
            trim((string)($data['descripcion'] ?? '')),
            trim((string)($data['detalle'] ?? '')),
            trim((string)($data['telefono'] ?? '')),
            trim((string)($data['email'] ?? '')),
            trim((string)($data['ubicacion'] ?? '')),
            $imagen,
            trim((string)($data['horarios'] ?? '')),
            trim((string)($redes['instagram'] ?? '')),
            trim((string)($redes['facebook'] ?? '')),
            $id,
        ]);

        $pdo->prepare('DELETE FROM emprendimiento_especialidades WHERE emprendimiento_id = ?')->execute([$id]);
        $insertSpecialty = $pdo->prepare('INSERT INTO emprendimiento_especialidades (emprendimiento_id, nombre, orden) VALUES (?, ?, ?)');
        foreach ($especialidades as $index => $especialidad) {
            $insertSpecialty->execute([$id, trim((string)$especialidad), $index + 1]);
        }

        $pdo->prepare('DELETE FROM emprendimiento_fotos WHERE emprendimiento_id = ?')->execute([$id]);
        $insertPhoto = $pdo->prepare('INSERT INTO emprendimiento_fotos (emprendimiento_id, url, orden) VALUES (?, ?, ?)');
        foreach ($fotos as $index => $foto) {
            $insertPhoto->execute([$id, trim((string)$foto), $index + 1]);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        jsonResponse(['ok' => false, 'error' => 'No se pudieron guardar los cambios'], 500);
    }

    jsonResponse(['ok' => true, 'emprendimiento' => getEmprendimiento($id)]);
}

jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
