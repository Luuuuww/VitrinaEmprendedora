<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

if (GOOGLE_CLIENT_ID === '') {
    jsonResponse(['ok' => false, 'error' => 'Falta configurar GOOGLE_CLIENT_ID en api/config.php o en el entorno del servidor'], 500);
}

$data = readJson();
$credential = trim((string)($data['credential'] ?? ''));

if ($credential === '') {
    jsonResponse(['ok' => false, 'error' => 'No se recibio la credencial de Google'], 422);
}

$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 6,
        'ignore_errors' => true,
    ],
]);
$tokenInfoRaw = @file_get_contents('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential), false, $context);
$tokenInfo = $tokenInfoRaw ? json_decode($tokenInfoRaw, true) : null;

if (!is_array($tokenInfo) || !empty($tokenInfo['error'])) {
    jsonResponse(['ok' => false, 'error' => 'No se pudo validar la cuenta de Google'], 401);
}

$audience = (string)($tokenInfo['aud'] ?? '');
$email = trim((string)($tokenInfo['email'] ?? ''));
$emailVerified = (string)($tokenInfo['email_verified'] ?? '') === 'true' || ($tokenInfo['email_verified'] ?? false) === true;

if ($audience !== GOOGLE_CLIENT_ID || $email === '' || !$emailVerified) {
    jsonResponse(['ok' => false, 'error' => 'La cuenta de Google no pudo ser verificada'], 401);
}

$user = getUserByUsuario($email);

if (!$user) {
    jsonResponse(['ok' => false, 'error' => 'Ese correo de Google no coincide con una cuenta registrada'], 401);
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
