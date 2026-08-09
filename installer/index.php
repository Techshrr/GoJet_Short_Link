<?php
declare(strict_types=1);

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
header('Cache-Control: no-store, max-age=0');

$root = dirname(__DIR__);
$state = $root . '/storage/installer';
$installedLock = $root . '/deploy/native/installed.lock';
if (is_file($installedLock)) {
    http_response_code(404);
    exit('Not Found');
}

if (isset($_GET['status'])) {
    header('Content-Type: application/json; charset=utf-8');
    $statusFile = $state . '/status.json';
    if (!is_file($statusFile)) {
        echo json_encode(['phase' => 'waiting', 'progress' => 0, 'message' => '等待安装任务启动', 'result' => 'running'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    readfile($statusFile);
    exit;
}

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('gojet_installer');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/install/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function h(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function post(string $key, string $fallback = ''): string { return trim((string)($_POST[$key] ?? $fallback)); }
function csrf(): void {
    if (!isset($_POST['csrf']) || !hash_equals((string)($_SESSION['csrf'] ?? ''), (string)$_POST['csrf'])) {
        http_response_code(419);
        exit('安装会话已失效，请刷新页面重试。');
    }
}
function redisCheck(int $port, string $password): array {
    $errno = 0; $errstr = '';
    $socket = @stream_socket_client("tcp://127.0.0.1:$port", $errno, $errstr, 2, STREAM_CLIENT_CONNECT);
    if (!$socket) return [false, "无法连接 Redis：$errstr"];
    stream_set_timeout($socket, 2);
    if ($password !== '') {
        $cmd = "*2\r\n$4\r\nAUTH\r\n$" . strlen($password) . "\r\n$password\r\n";
        fwrite($socket, $cmd);
        $reply = fgets($socket);
        if (!is_string($reply) || !str_starts_with($reply, '+OK')) { fclose($socket); return [false, 'Redis 密码验证失败']; }
    }
    fwrite($socket, "*1\r\n$4\r\nPING\r\n");
    $reply = fgets($socket);
    fclose($socket);
    return [is_string($reply) && str_starts_with($reply, '+PONG'), 'Redis PING 未返回 PONG'];
}
function clamavCheck(): array {
    global $state;
    $socketPath = '/run/clamav/clamd.ctl';
    if (is_file($state . '/clamav.ready') && file_exists($socketPath)) return [true, 'ClamAV Unix Socket 已由 Root 准备程序验证'];
    if (!file_exists($socketPath)) return [false, '未检测到 ClamAV；文件分享安装后暂不可用'];
    $errno = 0; $errstr = '';
    $socket = @stream_socket_client('unix://' . $socketPath, $errno, $errstr, 2, STREAM_CLIENT_CONNECT);
    if (!$socket) return [false, 'ClamAV Socket 存在但当前不可连接'];
    fwrite($socket, "PING\n");
    stream_set_timeout($socket, 2);
    $reply = fgets($socket);
    fclose($socket);
    return [is_string($reply) && str_contains($reply, 'PONG'), 'ClamAV 未返回 PONG'];
}
function writeRequest(string $state, array $values): bool {
    $allowed = ['MYSQL_PORT','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD','REDIS_PORT','REDIS_PASSWORD','PUBLIC_BASE_URL','ADMIN_EMAIL','ADMIN_PASSWORD','ALERT_EMAIL'];
    $body = '';
    foreach ($allowed as $key) {
        $body .= $key . '=' . base64_encode((string)($values[$key] ?? '')) . "\n";
    }
    $tmp = $state . '/request.tmp';
    if (file_put_contents($tmp, $body, LOCK_EX) === false) return false;
    chmod($tmp, 0600);
    return rename($tmp, $state . '/request.ready');
}

$checks = [
    'bootstrap' => [is_file($state . '/bootstrap.ready'), 'Root 安装准备程序'],
    'php' => [version_compare(PHP_VERSION, '8.3.0', '>='), 'PHP 8.3+（当前 ' . PHP_VERSION . '）'],
    'pdo' => [extension_loaded('pdo_mysql'), 'PDO MySQL 扩展'],
    'openssl' => [extension_loaded('openssl'), 'OpenSSL 扩展'],
    'arch' => [PHP_INT_SIZE === 8, '64 位 PHP'],
    'binaries' => [count(array_filter(['redirect-engine','analytics-worker','analytics-reconciler','platform-api','mail-worker','file-worker','operations-monitor','log-receiver'], fn($b) => is_executable($root . '/bin/' . $b))) === 8, '8 个 GoJet Linux 服务程序'],
    'state' => [is_dir($state) && is_writable($state), '安装状态目录可写'],
];
[$clamavOk, $clamavMessage] = clamavCheck();
$errors = [];
$step = max(1, min(4, (int)($_SESSION['step'] ?? 1)));
$installQueued = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf();
    $action = post('action');
    if ($action === 'environment') {
        foreach ($checks as [$ok, $label]) if (!$ok) $errors[] = "$label 未通过";
        if (!$isHttps) $errors[] = '请先在宝塔为站点启用 HTTPS，然后从 HTTPS 地址进入安装页';
        if (!$errors) { $_SESSION['step'] = $step = 2; }
    } elseif ($action === 'connections') {
        $mysqlPort = (int)post('mysql_port', '3306');
        $db = post('mysql_database', 'gojet');
        $user = post('mysql_user', 'gojet');
        $pass = (string)($_POST['mysql_password'] ?? '');
        $redisPort = (int)post('redis_port', '6379');
        $redisPassword = (string)($_POST['redis_password'] ?? '');
        if ($mysqlPort < 1 || $mysqlPort > 65535) $errors[] = 'MySQL 端口无效';
        if (!preg_match('/^[A-Za-z0-9_]+$/', $db)) $errors[] = '数据库名只能包含字母、数字和下划线';
        if (!preg_match('/^[A-Za-z0-9_.-]+$/', $user)) $errors[] = '数据库用户名格式无效';
        if ($pass === '') $errors[] = '请输入数据库用户密码';
        if ($redisPort < 1 || $redisPort > 65535) $errors[] = 'Redis 端口无效';
        if (!$errors) {
            try {
                $pdo = new PDO("mysql:host=127.0.0.1;port=$mysqlPort;dbname=$db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]);
                $version = (string)$pdo->query('SELECT VERSION()')->fetchColumn();
                if (!str_starts_with($version, '8.')) $errors[] = "需要 MySQL 8.x，当前为 $version";
                $pdo->query('SELECT 1');
            } catch (Throwable $e) { $errors[] = 'MySQL 连接失败：' . $e->getMessage(); }
            [$redisOk, $redisMessage] = redisCheck($redisPort, $redisPassword);
            if (!$redisOk) $errors[] = $redisMessage;
        }
        if (!$errors) {
            $_SESSION['database'] = ['port' => $mysqlPort, 'database' => $db, 'user' => $user, 'password' => $pass];
            $_SESSION['redis'] = ['port' => $redisPort, 'password' => $redisPassword];
            $_SESSION['step'] = $step = 3;
        }
    } elseif ($action === 'site') {
        $publicUrl = rtrim(post('public_url'), '/');
        $adminEmail = post('admin_email');
        $adminPassword = (string)($_POST['admin_password'] ?? '');
        $confirm = (string)($_POST['admin_password_confirm'] ?? '');
        $alertEmail = post('alert_email');
        if ($alertEmail === '') $alertEmail = $adminEmail;
        if (!filter_var($publicUrl, FILTER_VALIDATE_URL) || !str_starts_with($publicUrl, 'https://')) $errors[] = '站点地址必须是有效的 HTTPS 地址';
        if ((string)parse_url($publicUrl, PHP_URL_PATH) !== '' && (string)parse_url($publicUrl, PHP_URL_PATH) !== '/') $errors[] = '站点地址必须是域名根地址，不能带路径';
        if (parse_url($publicUrl, PHP_URL_QUERY) !== null || parse_url($publicUrl, PHP_URL_FRAGMENT) !== null) $errors[] = '站点地址不能包含查询参数或片段';
        if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) $errors[] = '管理员邮箱格式不正确';
        if (!filter_var($alertEmail, FILTER_VALIDATE_EMAIL)) $errors[] = '告警邮箱格式不正确';
        if (strlen($adminPassword) < 12) $errors[] = '管理员密码至少 12 位';
        if (!hash_equals($adminPassword, $confirm)) $errors[] = '管理员密码两次输入不一致';
        if (!$errors) {
            $_SESSION['site'] = ['public_url' => $publicUrl, 'admin_email' => $adminEmail, 'admin_password' => $adminPassword, 'alert_email' => $alertEmail];
            $_SESSION['step'] = $step = 4;
        }
    } elseif ($action === 'install') {
        if (empty($_SESSION['database']) || empty($_SESSION['redis']) || empty($_SESSION['site'])) {
            $errors[] = '安装参数不完整，请返回重新填写';
            $_SESSION['step'] = $step = 1;
        } elseif (is_file($state . '/request.ready') || is_file($state . '/request.processing')) {
            $errors[] = '已有安装任务正在执行，请不要重复提交';
        } else {
            $db = $_SESSION['database']; $redis = $_SESSION['redis']; $site = $_SESSION['site'];
            $request = [
                'MYSQL_PORT' => (string)$db['port'], 'MYSQL_DATABASE' => (string)$db['database'], 'MYSQL_USER' => (string)$db['user'], 'MYSQL_PASSWORD' => (string)$db['password'],
                'REDIS_PORT' => (string)$redis['port'], 'REDIS_PASSWORD' => (string)$redis['password'],
                'PUBLIC_BASE_URL' => (string)$site['public_url'], 'ADMIN_EMAIL' => (string)$site['admin_email'], 'ADMIN_PASSWORD' => (string)$site['admin_password'], 'ALERT_EMAIL' => (string)$site['alert_email'],
            ];
            @unlink($state . '/status.json');
            if (!writeRequest($state, $request)) $errors[] = '无法提交安装任务，请检查 storage/installer 权限';
            else { $installQueued = true; session_unset(); session_destroy(); }
        }
    } elseif ($action === 'back') {
        $_SESSION['step'] = $step = max(1, $step - 1);
    }
}

$host = preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
$defaultUrl = ($host !== '') ? 'https://' . $host : 'https://go.example.com';
$dbData = $_SESSION['database'] ?? ['port' => 3306, 'database' => 'gojet', 'user' => 'gojet'];
$redisData = $_SESSION['redis'] ?? ['port' => 6379];
$siteData = $_SESSION['site'] ?? ['public_url' => $defaultUrl, 'admin_email' => '', 'alert_email' => ''];
?><!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GoJet 安装向导</title>
<style>
:root{font-family:Inter,"Noto Sans SC",system-ui,sans-serif;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#07111f;color:#eaf2ff}.shell{max-width:920px;margin:0 auto;padding:42px 20px 70px}.brand{font-size:27px;font-weight:850;letter-spacing:-.5px}.brand b{color:#42d6a5}.card{margin-top:22px;background:#0d1b2d;border:1px solid #203650;border-radius:18px;padding:28px;box-shadow:0 24px 80px #0007}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0 28px}.step{padding:10px;border-radius:9px;background:#101f32;color:#7187a2;font-size:13px;text-align:center}.step.on{background:#173851;color:#dffaf1}.step.done{color:#42d6a5}h1{margin:0;font-size:29px}h2{margin-top:28px;font-size:19px}p,.muted{color:#9fb2ca;line-height:1.7}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.check{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#102237;border-radius:10px;margin:8px 0}.ok{color:#42d6a5}.warn{color:#ffc86a}.bad,.errors{color:#ff9292}.errors{background:#381b27;border-radius:10px;padding:14px 18px}label{display:block;color:#b9c9dc;font-size:13px;margin-top:12px}input{display:block;width:100%;margin-top:6px;padding:12px 13px;background:#071522;color:#fff;border:1px solid #2a4562;border-radius:9px;outline:none}input:focus{border-color:#42d6a5}.fixed{opacity:.75}.actions{display:flex;gap:12px;margin-top:25px}.btn{border:0;border-radius:10px;padding:13px 20px;font-weight:750;cursor:pointer;background:#42d6a5;color:#052218}.btn.secondary{background:#172a40;color:#cbd8e8}.summary{display:grid;grid-template-columns:170px 1fr;gap:8px 16px;background:#102237;padding:18px;border-radius:12px}.summary dt{color:#8197b1}.summary dd{margin:0;word-break:break-all}.progress{height:10px;border-radius:99px;background:#13273d;overflow:hidden;margin:25px 0}.bar{height:100%;width:0;background:#42d6a5;transition:width .35s}.center{text-align:center;padding:25px 0 10px}@media(max-width:680px){.grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}.summary{grid-template-columns:1fr}.summary dt{margin-top:8px}}
</style></head><body><main class="shell"><div class="brand">Go<b>Jet</b></div><section class="card">
<?php if ($installQueued): ?>
<div class="center"><h1>正在安装 GoJet</h1><p id="install-message">安装任务已经安全提交给系统服务。</p><div class="progress"><div class="bar" id="bar"></div></div><p class="muted" id="phase">准备开始…</p></div>
<script>
const poll=async()=>{try{const r=await fetch('/install/?status=1',{cache:'no-store'});const s=await r.json();document.getElementById('bar').style.width=(s.progress||0)+'%';document.getElementById('install-message').textContent=s.message||'正在安装';document.getElementById('phase').textContent='阶段：'+(s.phase||'waiting');if(s.result==='success'){document.getElementById('phase').textContent='安装成功。正在进入管理后台…';setTimeout(()=>location.href='/admin/',1800);return}if(s.result==='failed'){document.getElementById('phase').textContent='安装失败。请根据上方错误处理后重新进入 /install/。';return}}catch(e){}setTimeout(poll,1200)};poll();
</script>
<?php else: ?>
<h1>GoJet V4 标准安装向导</h1><p>宝塔 Native 安装模式。无需 MySQL root 密码，不使用临时 token，也不开放 18088 安装端口。</p>
<div class="steps"><?php foreach ([1=>'环境检查',2=>'数据库与 Redis',3=>'站点与管理员',4=>'确认安装'] as $n=>$label): ?><div class="step <?= $n===$step?'on':($n<$step?'done':'') ?>"><?=h($label)?></div><?php endforeach ?></div>
<?php if ($errors): ?><ul class="errors"><?php foreach ($errors as $error): ?><li><?=h($error)?></li><?php endforeach ?></ul><?php endif ?>
<?php if ($step === 1): ?>
<h2>服务器环境</h2><?php foreach ($checks as [$ok,$label]): ?><div class="check"><span><?=h($label)?></span><b class="<?=$ok?'ok':'bad'?>"><?=$ok?'通过':'未通过'?></b></div><?php endforeach ?>
<div class="check"><span>ClamAV 文件安全扫描</span><b class="<?=$clamavOk?'ok':'warn'?>"><?=$clamavOk?'已就绪':'暂不可用'?></b></div><?php if(!$clamavOk): ?><p class="warn"><?=h($clamavMessage)?>。这不会阻止主系统安装，但文件分享会保持不可用，直到安装并启动 ClamAV。</p><?php endif ?>
<form method="post"><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><input type="hidden" name="action" value="environment"><div class="actions"><button class="btn" type="submit">继续</button></div></form>
<?php elseif ($step === 2): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><h2>MySQL 数据库</h2><div class="grid"><label>数据库地址<input class="fixed" value="127.0.0.1" disabled></label><label>端口<input name="mysql_port" inputmode="numeric" value="<?=h((string)$dbData['port'])?>" required></label><label>数据库名称<input name="mysql_database" value="<?=h((string)$dbData['database'])?>" required></label><label>数据库用户名<input name="mysql_user" value="<?=h((string)$dbData['user'])?>" required></label><label>数据库用户密码<input name="mysql_password" type="password" autocomplete="new-password" required></label></div><p class="muted">请先在宝塔中创建数据库和普通数据库用户。GoJet 不会索取或保存 MySQL root 密码。</p><h2>Redis</h2><div class="grid"><label>Redis 地址<input class="fixed" value="127.0.0.1" disabled></label><label>端口<input name="redis_port" inputmode="numeric" value="<?=h((string)$redisData['port'])?>" required></label><label>Redis 密码<input name="redis_password" type="password" autocomplete="new-password"><span class="muted">本机 Redis 未设置密码时可留空。</span></label></div><div class="actions"><button class="btn secondary" type="submit" name="action" value="back">返回</button><button class="btn" type="submit" name="action" value="connections">测试连接并继续</button></div></form>
<?php elseif ($step === 3): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><h2>站点</h2><div class="grid"><label>正式 HTTPS 地址<input name="public_url" value="<?=h((string)$siteData['public_url'])?>" required></label><label>管理员邮箱<input name="admin_email" type="email" value="<?=h((string)$siteData['admin_email'])?>" required></label><label>管理员密码<input name="admin_password" type="password" minlength="12" autocomplete="new-password" required></label><label>再次输入管理员密码<input name="admin_password_confirm" type="password" minlength="12" autocomplete="new-password" required></label><label>系统告警邮箱<input name="alert_email" type="email" value="<?=h((string)$siteData['alert_email'])?>" placeholder="默认与管理员邮箱相同"></label></div><p class="muted">加密密钥、访客哈希密钥、QR 跟踪密钥和日志 Token 全部由安装器使用 CSPRNG 自动生成，不要求人工填写。</p><div class="actions"><button class="btn secondary" type="submit" name="action" value="back">返回</button><button class="btn" type="submit" name="action" value="site">继续</button></div></form>
<?php else: $db=$_SESSION['database'];$redis=$_SESSION['redis'];$site=$_SESSION['site']; ?>
<h2>确认安装</h2><dl class="summary"><dt>网站</dt><dd><?=h((string)$site['public_url'])?></dd><dt>MySQL</dt><dd>127.0.0.1:<?=h((string)$db['port'])?> / <?=h((string)$db['database'])?> / <?=h((string)$db['user'])?></dd><dt>Redis</dt><dd>127.0.0.1:<?=h((string)$redis['port'])?></dd><dt>管理员</dt><dd><?=h((string)$site['admin_email'])?></dd><dt>ClamAV</dt><dd><?=$clamavOk?'Unix Socket 已就绪':'未就绪，文件分享暂不可用'?></dd></dl><p class="muted">开始后将执行数据库迁移、生成安全密钥、注册并启动 8 个 systemd 服务、写入宝塔 Nginx 路由并执行健康检查。</p><form method="post"><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><div class="actions"><button class="btn secondary" type="submit" name="action" value="back">返回</button><button class="btn" type="submit" name="action" value="install">开始安装</button></div></form>
<?php endif ?>
<?php endif ?></section></main></body></html>
