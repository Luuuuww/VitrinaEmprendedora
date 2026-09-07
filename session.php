<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

$authenticated = !empty($_SESSION['usuario_id']);
$emprendimientos = [];

if ($authenticated) {
    $emprendimientos = getAccountEmprendimientos(
        (int)$_SESSION['usuario_id'],
        (int)($_SESSION['emprendimiento_id'] ?? 0)
    );
}

jsonResponse([
    'ok' => true,
    'authenticated' => $authenticated,
    'usuario' => $_SESSION['usuario'] ?? null,
    'emprendimientoId' => null,
    'emprendimientos' => $emprendimientos,
]);
