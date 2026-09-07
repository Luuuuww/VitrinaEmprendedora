<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');

const DB_HOST = '127.0.0.1';
const DB_NAME = 'vitrina_emprendedora';
const DB_USER = 'root';
const DB_PASS = '';
const GOOGLE_CLIENT_ID_LOCAL = '936975403518-r00rh6st29lvk0hhc0euivqpmtem9ffp.apps.googleusercontent.com';
const IDRIVEE2_ENDPOINT = 's3.us-southeast-1.idrivee2.com';
const IDRIVEE2_REGION = 'us-southeast-1';
const IDRIVEE2_BUCKET = 'vitrina';
const IDRIVEE2_ACCESS_KEY = 'IeFxjWFGhtCzJPm6oz6L';
const IDRIVEE2_SECRET_KEY = 'EZmrEta56bSKbmDQdPEtAWFzew5z1P5Fb47BctMe';
const IDRIVEE2_PUBLIC_BASE_URL = 'https://vitrina.s3.us-southeast-1.idrivee2.com';

define('GOOGLE_CLIENT_ID', trim((string)(getenv('GOOGLE_CLIENT_ID') ?: GOOGLE_CLIENT_ID_LOCAL)));

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function readJson(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function requireLogin(): void
{
    if (empty($_SESSION['usuario_id'])) {
        jsonResponse(['ok' => false, 'error' => 'No autorizado'], 401);
    }
}

function dbColumnExists(string $table, string $column): bool
{
    $stmt = db()->prepare(
        'SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?'
    );
    $stmt->execute([$table, $column]);

    return (int)$stmt->fetchColumn() > 0;
}

function ensureUserLinkSchema(): void
{
    if (!dbColumnExists('emprendedores', 'usuario_id')) {
        db()->exec('ALTER TABLE emprendedores ADD usuario_id INT UNSIGNED NULL AFTER id');
    }

    db()->exec(
        'UPDATE emprendedores e
         JOIN usuarios u ON u.emprendimiento_id = e.id
         SET e.usuario_id = u.id
         WHERE e.usuario_id IS NULL'
    );
}

function getAccountEmprendimientos(int $usuarioId, int $fallbackEmprendimientoId = 0): array
{
    ensureUserLinkSchema();

    $stmt = db()->prepare(
        'SELECT id, nombre, negocio, categoria, descripcion, telefono, email, ubicacion, imagen
         FROM emprendedores
         WHERE usuario_id = ?
            OR (? > 0 AND id = ?)
         GROUP BY id
         ORDER BY id'
    );
    $stmt->execute([$usuarioId, $fallbackEmprendimientoId, $fallbackEmprendimientoId]);

    return $stmt->fetchAll();
}
function getUserByCredentials(string $usuario, string $password): ?array
{
    $stmt = db()->prepare('SELECT id, usuario, emprendimiento_id FROM usuarios WHERE usuario = ? AND password_hash = SHA2(?, 256) LIMIT 1');
    $stmt->execute([$usuario, $password]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function getUserByUsuario(string $usuario): ?array
{
    $stmt = db()->prepare('SELECT id, usuario, emprendimiento_id FROM usuarios WHERE usuario = ? LIMIT 1');
    $stmt->execute([$usuario]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function handleEnhancedRegisterRequest(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || basename((string)($_SERVER['SCRIPT_NAME'] ?? '')) !== 'register.php') {
        return;
    }

    $data = readJson();
    $tieneCuenta = (string)($data['tieneCuentaEmprendedor'] ?? 'no') === 'si';
    $cuentaUsuario = trim((string)($data['cuentaUsuario'] ?? ''));
    $cuentaPassword = trim((string)($data['cuentaPassword'] ?? ''));
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

    if ($nombre === '' || $email === '' || (!$tieneCuenta && $password === '') || $negocio === '' || $categoria === '' || $descripcion === '') {
        jsonResponse(['ok' => false, 'error' => 'Faltan datos obligatorios'], 422);
    }

    if (mb_strlen($descripcion) > 250) {
        jsonResponse(['ok' => false, 'error' => 'La descripcion breve no puede superar los 250 caracteres'], 422);
    }

    $pdo = db();
    ensureUserLinkSchema();

    $usuarioId = null;
    $usuarioPrincipal = $email;

    if ($tieneCuenta) {
        if ($cuentaUsuario === '' || $cuentaPassword === '') {
            jsonResponse(['ok' => false, 'error' => 'Ingresa el usuario y la contrasena de tu cuenta emprendedora'], 422);
        }

        $user = getUserByCredentials($cuentaUsuario, $cuentaPassword);
        if (!$user) {
            jsonResponse(['ok' => false, 'error' => 'La cuenta emprendedora no existe o la contrasena es incorrecta'], 401);
        }

        $usuarioId = (int)$user['id'];
        $usuarioPrincipal = $user['usuario'];
    } else {
        $exists = $pdo->prepare('SELECT id FROM usuarios WHERE usuario = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            jsonResponse(['ok' => false, 'error' => 'Ya existe una cuenta registrada con ese email. Marca que ya tienes cuenta para cargar otro emprendimiento.'], 409);
        }
    }

    $registroDatos = json_encode($data, JSON_UNESCAPED_UNICODE);
    $imagen = $fotos[0] ?? '';
    $especialidades = [$categoria];

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO emprendedores
              (usuario_id, nombre, negocio, categoria, descripcion, detalle, calificacion, total_resenas, telefono, email, ubicacion, imagen, horarios, instagram, facebook, registro_datos)
             VALUES
              (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $usuarioId,
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

        if ($tieneCuenta) {
            $pdo->prepare('UPDATE emprendedores SET usuario_id = ? WHERE id = ?')->execute([$usuarioId, $emprendimientoId]);
        } else {
            $userStmt = $pdo->prepare('INSERT INTO usuarios (usuario, password_hash, emprendimiento_id) VALUES (?, SHA2(?, 256), ?)');
            $userStmt->execute([$email, $password, $emprendimientoId]);
            $usuarioId = (int)$pdo->lastInsertId();
            $pdo->prepare('UPDATE emprendedores SET usuario_id = ? WHERE id = ?')->execute([$usuarioId, $emprendimientoId]);
        }

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

    $_SESSION['usuario_id'] = $usuarioId;
    $_SESSION['usuario'] = $usuarioPrincipal;
    $_SESSION['emprendimiento_id'] = $emprendimientoId;

    jsonResponse(['ok' => true, 'emprendimientoId' => $emprendimientoId]);
}

handleEnhancedRegisterRequest();
