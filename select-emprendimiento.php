<?php
declare(strict_types=1);

require __DIR__ . '/api/config.php';
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

$data = readJson();
$id = (int)($data['emprendimientoId'] ?? 0);
if ($id <= 0) {
    jsonResponse(['ok' => false, 'error' => 'Emprendimiento invalido'], 422);
}

ensureUserLinkSchema();
$stmt = db()->prepare('SELECT id FROM emprendedores WHERE id = ? AND usuario_id = ? LIMIT 1');
$stmt->execute([$id, (int)$_SESSION['usuario_id']]);

if (!$stmt->fetch()) {
    $fallback = (int)($_SESSION['emprendimiento_id'] ?? 0);
    if ($id !== $fallback) {
        jsonResponse(['ok' => false, 'error' => 'No autorizado para editar este emprendimiento'], 403);
    }
}

$_SESSION['emprendimiento_id'] = $id;
jsonResponse(['ok' => true, 'emprendimientoId' => $id]);