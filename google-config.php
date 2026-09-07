<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

jsonResponse([
    'ok' => true,
    'clientId' => GOOGLE_CLIENT_ID,
    'configured' => GOOGLE_CLIENT_ID !== '',
]);
