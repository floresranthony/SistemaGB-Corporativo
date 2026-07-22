<?php
// Prevent PHP warnings/notices from polluting JSON output
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, x-file-name');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$fileNameHeader = $_SERVER['HTTP_X_FILE_NAME'] ?? '';
if (empty($fileNameHeader)) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta el nombre de archivo (x-file-name)']);
    exit;
}

$fileName = rawurldecode($fileNameHeader);
$fileName = basename($fileName); // Sanitize to avoid directory traversal

if (empty($fileName)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nombre de archivo no válido']);
    exit;
}

$uploadDir = __DIR__ . '/../uploads/logos/';
if (!file_exists($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo crear el directorio de subida']);
        exit;
    }
}

$rawData = file_get_contents('php://input');
if ($rawData === false) {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudieron leer los datos del archivo']);
    exit;
}

$filePath = $uploadDir . $fileName;
$success = file_put_contents($filePath, $rawData);

if ($success !== false) {
    echo json_encode([
        'success' => true,
        'path' => 'uploads/logos/' . $fileName
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo guardar el archivo en el servidor']);
}
