<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
if (isset($_GET['status'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    $statusFile = $root . '/storage/installer/status.json';
    if (is_file($statusFile)) {
        readfile($statusFile);
    } else {
        echo json_encode(['phase' => 'waiting', 'progress' => 0, 'message' => '等待安装任务启动', 'result' => 'running'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

require $root . '/installer/index.php';
