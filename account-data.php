<?php
declare(strict_types=1);

require __DIR__ . '/api/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

$data = readJson();
$usuario = trim((string)($data['usuario'] ?? ''));
$password = trim((string)($data['password'] ?? ''));

if ($usuario === '' || $password === '') {
    jsonResponse(['ok' => false, 'error' => 'Ingresa usuario y contrasena'], 422);
}

$user = getUserByCredentials($usuario, $password);
if (!$user) {
    jsonResponse(['ok' => false, 'error' => 'Cuenta o contrasena incorrecta'], 401);
}

ensureUserLinkSchema();
$items = getAccountEmprendimientos((int)$user['id'], (int)$user['emprendimiento_id']);
$lastId = (int)($items[count($items) - 1]['id'] ?? $user['emprendimiento_id']);
$stmt = db()->prepare('SELECT nombre, telefono, email, ubicacion, registro_datos FROM emprendedores WHERE id = ? LIMIT 1');
$stmt->execute([$lastId]);
$row = $stmt->fetch();
$registro = [];
if ($row && !empty($row['registro_datos'])) {
    $decoded = json_decode((string)$row['registro_datos'], true);
    $registro = is_array($decoded) ? $decoded : [];
}

$fields = [
    'nombreApellido' => $registro['nombreApellido'] ?? ($row['nombre'] ?? ''),
    'dni' => $registro['dni'] ?? '',
    'fechaNacimiento' => $registro['fechaNacimiento'] ?? '',
    'domicilioParticular' => $registro['domicilioParticular'] ?? '',
    'telefono' => $registro['telefono'] ?? ($row['telefono'] ?? ''),
    'email' => $registro['email'] ?? ($row['email'] ?? $user['usuario']),
    'estadoActual' => $registro['estadoActual'] ?? '',
    'cuitCuil' => $registro['cuitCuil'] ?? '',
    'condicionFiscal' => $registro['condicionFiscal'] ?? '',
    'inscripcionIIBB' => $registro['inscripcionIIBB'] ?? '',
];

jsonResponse([
    'ok' => true,
    'usuario' => $user['usuario'],
    'fields' => $fields,
]);