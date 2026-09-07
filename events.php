<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

/**
 * Public API for the city calendar. MongoDB credentials are read exclusively
 * from server environment variables, never from the browser or this file.
 */

function eventsCollection()
{
    $autoload = dirname(__DIR__) . '/vendor/autoload.php';
    if (!is_file($autoload)) {
        jsonResponse(['ok' => false, 'error' => 'Falta instalar la librería PHP mongodb con Composer'], 503);
    }
    require_once $autoload;

    if (!extension_loaded('mongodb')) {
        jsonResponse(['ok' => false, 'error' => 'El servidor no tiene instalada la extensión PHP mongodb'], 503);
    }

    $uri = trim((string)getenv('MONGODB_URI'));
    if ($uri === '') {
        jsonResponse(['ok' => false, 'error' => 'MongoDB no está configurado en el servidor'], 503);
    }

    try {
        $database = trim((string)getenv('MONGODB_DATABASE')) ?: 'vitrina_emprendedora';
        return (new MongoDB\Client($uri))->selectCollection($database, 'eventos');
    } catch (Throwable $error) {
        jsonResponse(['ok' => false, 'error' => 'No se pudo inicializar la conexión con MongoDB'], 503);
    }
}

function eventDocument(array $document): array
{
    return [
        'id' => (string)$document['_id'],
        'title' => (string)($document['title'] ?? ''),
        'date' => (string)($document['date'] ?? ''),
        'time' => (string)($document['time'] ?? ''),
        'place' => (string)($document['place'] ?? ''),
        'type' => (string)($document['type'] ?? 'Evento'),
    ];
}

function validEvent(array $data): array
{
    $title = trim((string)($data['title'] ?? ''));
    $date = trim((string)($data['date'] ?? ''));
    $time = trim((string)($data['time'] ?? ''));
    $place = trim((string)($data['place'] ?? ''));

    if ($title === '' || mb_strlen($title) > 120 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || mb_strlen($place) > 100) {
        jsonResponse(['ok' => false, 'error' => 'Los datos del evento no son válidos'], 422);
    }

    return ['title' => $title, 'date' => $date, 'time' => $time, 'place' => $place, 'type' => 'Evento'];
}

function requireEventsAdmin(): void
{
    if (empty($_SESSION['events_admin'])) {
        jsonResponse(['ok' => false, 'error' => 'No autorizado'], 401);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

if ($method === 'POST' && $action === 'login') {
    $data = readJson();
    $user = trim((string)($data['usuario'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $configuredUser = (string)getenv('EVENTS_ADMIN_USER');
    $configuredPassword = (string)getenv('EVENTS_ADMIN_PASSWORD');

    if ($configuredUser === '' || $configuredPassword === '' || !hash_equals($configuredUser, $user) || !hash_equals($configuredPassword, $password)) {
        jsonResponse(['ok' => false, 'error' => 'Credenciales de eventos incorrectas'], 401);
    }

    $_SESSION['events_admin'] = true;
    jsonResponse(['ok' => true]);
}

if ($method === 'POST' && $action === 'logout') {
    unset($_SESSION['events_admin']);
    jsonResponse(['ok' => true]);
}

if ($method === 'GET' && $action === 'session') {
    jsonResponse(['ok' => true, 'authenticated' => !empty($_SESSION['events_admin'])]);
}

try {
    $collection = eventsCollection();

    if ($method === 'GET') {
        $cursor = $collection->find([], ['sort' => ['date' => 1, 'time' => 1]]);
        $events = [];
        foreach ($cursor as $event) {
            $events[] = eventDocument((array)$event);
        }
        jsonResponse(['ok' => true, 'events' => $events]);
    }

    requireEventsAdmin();
    $data = readJson();
    if ($method === 'POST') {
        $event = validEvent($data);
        $result = $collection->insertOne($event);
        jsonResponse(['ok' => true, 'id' => (string)$result->getInsertedId()]);
    }

    $id = trim((string)($data['id'] ?? ''));
    if (!preg_match('/^[a-f0-9]{24}$/i', $id)) {
        jsonResponse(['ok' => false, 'error' => 'Identificador de evento inválido'], 422);
    }
    $objectId = new MongoDB\BSON\ObjectId($id);

    if ($method === 'PUT') {
        $result = $collection->updateOne(['_id' => $objectId], ['$set' => validEvent($data)]);
        if ($result->getMatchedCount() === 0) jsonResponse(['ok' => false, 'error' => 'Evento no encontrado'], 404);
        jsonResponse(['ok' => true]);
    }

    if ($method === 'DELETE') {
        $collection->deleteOne(['_id' => $objectId]);
        jsonResponse(['ok' => true]);
    }

    jsonResponse(['ok' => false, 'error' => 'Método no permitido'], 405);
} catch (Throwable $error) {
    jsonResponse(['ok' => false, 'error' => 'No se pudo completar la operación con MongoDB'], 500);
}
