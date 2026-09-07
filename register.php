<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

$data = readJson();

$nombre = trim((string)($data['nombreApellido'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$password = trim((string)($data['password'] ?? ''));
$negocio = trim((string)($data['nombreEmprendimiento'] ?? ''));
$categoria = trim((string)($data['rubroActividad'] ?? ''));
$descripcion = trim((string)($data['descripcionEmprendimiento'] ?? ''));
$telefono = trim((string)($data['telefono'] ?? ''));
$ubicacion = trim((string)($data['direccionActividad'] ?? ''));
$redSocial = trim((string)($data['redSocial'] ?? ''));
$fotos = array_values(array_filter($data['fotos'] ?? [], fn ($foto) => trim((string)$foto) !== ''));

if ($nombre === '' || $email === '' || $password === '' || $negocio === '' || $categoria === '' || $descripcion === '') {
    jsonResponse(['ok' => false, 'error' => 'Faltan datos obligatorios'], 422);
}

$pdo = db();
$exists = $pdo->prepare('SELECT id FROM usuarios WHERE usuario = ? LIMIT 1');
$exists->execute([$email]);

if ($exists->fetch()) {
    jsonResponse(['ok' => false, 'error' => 'Ya existe una cuenta registrada con ese email'], 409);
}

$registroDatos = json_encode($data, JSON_UNESCAPED_UNICODE);
$imagen = $fotos[0] ?? '';
$especialidades = [$categoria];

$pdo->beginTransaction();

try {
    $stmt = $pdo->prepare(
        'INSERT INTO emprendedores
          (nombre, negocio, categoria, descripcion, detalle, calificacion, total_resenas, telefono, email, ubicacion, imagen, horarios, instagram, facebook, registro_datos)
         VALUES
          (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        $nombre,
        $negocio,
        $categoria,
        $descripcion,
        $descripcion,
        $telefono,
        $email,
        $ubicacion,
        $imagen,
        'Consultar con el emprendimiento',
        $redSocial,
        '',
        $registroDatos,
    ]);

    $emprendimientoId = (int)$pdo->lastInsertId();

    $userStmt = $pdo->prepare('INSERT INTO usuarios (usuario, password_hash, emprendimiento_id) VALUES (?, SHA2(?, 256), ?)');
    $userStmt->execute([$email, $password, $emprendimientoId]);

    $specialtyStmt = $pdo->prepare('INSERT INTO emprendimiento_especialidades (emprendimiento_id, nombre, orden) VALUES (?, ?, ?)');
    foreach ($especialidades as $index => $especialidad) {
        $specialtyStmt->execute([$emprendimientoId, $especialidad, $index + 1]);
    }

    $photoStmt = $pdo->prepare('INSERT INTO emprendimiento_fotos (emprendimiento_id, url, orden) VALUES (?, ?, ?)');
    foreach ($fotos as $index => $foto) {
        $photoStmt->execute([$emprendimientoId, $foto, $index + 1]);
    }

    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    jsonResponse(['ok' => false, 'error' => 'No se pudo guardar el registro'], 500);
}

jsonResponse(['ok' => true, 'emprendimientoId' => $emprendimientoId]);
