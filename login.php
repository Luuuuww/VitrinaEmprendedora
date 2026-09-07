<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

$data = readJson();
$usuario = trim((string)($data['usuario'] ?? ''));
$password = trim((string)($data['password'] ?? ''));

$user = getUserByCredentials($usuario, $password);

if (!$user) {
    jsonResponse(['ok' => false, 'error' => 'Usuario o contrasena incorrectos'], 401);
}

$emprendimientos = getAccountEmprendimientos((int)$user['id'], (int)$user['emprendimiento_id']);

$_SESSION['usuario_id'] = (int)$user['id'];
$_SESSION['usuario'] = $user['usuario'];
unset($_SESSION['emprendimiento_id']);

jsonResponse([
    'ok' => true,
    'usuario' => $user['usuario'],
    'emprendimientoId' => null,
    'emprendimientos' => $emprendimientos,
]);
