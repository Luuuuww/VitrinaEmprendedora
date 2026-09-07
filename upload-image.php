<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'Metodo no permitido'], 405);
}

if (empty($_FILES['imagenes'])) {
    jsonResponse(['ok' => false, 'error' => 'No se recibieron imagenes'], 422);
}

function s3PathEncode(string $path): string
{
    return implode('/', array_map('rawurlencode', explode('/', $path)));
}

function s3SigningKey(string $secretKey, string $date, string $region): string
{
    $dateKey = hash_hmac('sha256', $date, 'AWS4' . $secretKey, true);
    $dateRegionKey = hash_hmac('sha256', $region, $dateKey, true);
    $dateRegionServiceKey = hash_hmac('sha256', 's3', $dateRegionKey, true);

    return hash_hmac('sha256', 'aws4_request', $dateRegionServiceKey, true);
}

function s3PublicUrl(string $key): string
{
    return rtrim(IDRIVEE2_PUBLIC_BASE_URL, '/') . '/' . s3PathEncode($key);
}

function uploadToIdriveE2(string $sourcePath, string $key, string $contentType): string
{
    $payloadHash = hash_file('sha256', $sourcePath);
    $timestamp = gmdate('Ymd\THis\Z');
    $date = gmdate('Ymd');
    $canonicalUri = '/' . IDRIVEE2_BUCKET . '/' . s3PathEncode($key);
    $host = IDRIVEE2_ENDPOINT;
    $signedHeaders = 'content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date';
    $canonicalHeaders =
        'content-type:' . $contentType . "\n" .
        'host:' . $host . "\n" .
        "x-amz-acl:public-read\n" .
        'x-amz-content-sha256:' . $payloadHash . "\n" .
        'x-amz-date:' . $timestamp . "\n";

    $canonicalRequest = implode("\n", [
        'PUT',
        $canonicalUri,
        '',
        $canonicalHeaders,
        $signedHeaders,
        $payloadHash,
    ]);

    $scope = $date . '/' . IDRIVEE2_REGION . '/s3/aws4_request';
    $stringToSign = implode("\n", [
        'AWS4-HMAC-SHA256',
        $timestamp,
        $scope,
        hash('sha256', $canonicalRequest),
    ]);
    $signature = hash_hmac('sha256', $stringToSign, s3SigningKey(IDRIVEE2_SECRET_KEY, $date, IDRIVEE2_REGION));

    $authorization = 'AWS4-HMAC-SHA256 Credential=' . IDRIVEE2_ACCESS_KEY . '/' . $scope .
        ', SignedHeaders=' . $signedHeaders .
        ', Signature=' . $signature;

    $handle = fopen($sourcePath, 'rb');
    if ($handle === false) {
        throw new RuntimeException('No se pudo leer la imagen');
    }

    $ch = curl_init('https://' . IDRIVEE2_ENDPOINT . $canonicalUri);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_INFILE => $handle,
        CURLOPT_INFILESIZE => filesize($sourcePath),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $authorization,
            'Content-Type: ' . $contentType,
            'Host: ' . $host,
            'x-amz-acl: public-read',
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $timestamp,
        ],
    ]);

    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    fclose($handle);

    if ($response === false || $status < 200 || $status >= 300) {
        throw new RuntimeException($error ?: 'No se pudo subir la imagen a IDrive e2');
    }

    return s3PublicUrl($key);
}

$files = $_FILES['imagenes'];
$names = is_array($files['name']) ? $files['name'] : [$files['name']];
$tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
$errors = is_array($files['error']) ? $files['error'] : [$files['error']];
$sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
$maxSize = 6 * 1024 * 1024;
$allowedTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];
$urls = [];

try {
    foreach ($tmpNames as $index => $tmpName) {
        if (($errors[$index] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('No se pudo recibir una de las imagenes');
        }

        if (($sizes[$index] ?? 0) > $maxSize) {
            throw new RuntimeException('Cada imagen debe pesar menos de 6 MB');
        }

        $mime = mime_content_type((string)$tmpName) ?: '';
        if (!isset($allowedTypes[$mime])) {
            throw new RuntimeException('Solo se permiten imagenes JPG, PNG, WebP o GIF');
        }

        $safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '-', pathinfo((string)($names[$index] ?? 'imagen'), PATHINFO_FILENAME));
        $safeName = trim((string)$safeName, '-') ?: 'imagen';
        $key = 'emprendimientos/' . date('Y/m') . '/' . bin2hex(random_bytes(8)) . '-' . $safeName . '.' . $allowedTypes[$mime];
        $urls[] = uploadToIdriveE2((string)$tmpName, $key, $mime);
    }
} catch (Throwable $error) {
    jsonResponse(['ok' => false, 'error' => $error->getMessage()], 500);
}

jsonResponse(['ok' => true, 'urls' => $urls]);
