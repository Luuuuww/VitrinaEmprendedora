<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

session_unset();
session_destroy();

jsonResponse(['ok' => true]);
