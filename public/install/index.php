<?php
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$state = $root . '/storage/installer';

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, max-age=0');

if (isset($_GET['status'])) {
    header('Content-Type: application/json; charset=utf-8');
    $statusFile = $state . '/status.json';
    if (is_file($statusFile)) {
        readfile($statusFile);
    } else {
        echo json_encode(['phase' => 'waiting', 'progress' => 0, 'message' => '等待安装任务启动', 'result' => 'running'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

function gojetInstallerActive(string $state): bool
{
    return is_file($state . '/request.ready') || is_file($state . '/request.processing');
}

function gojetRenderInstallerProgress(): never
{
    header("Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    echo <<<'HTML'
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>正在安装 GoJet</title>
<link rel="stylesheet" href="/install/install.css">
</head>
<body>
<main class="progressPage">
  <header class="progressTop">
    <div class="progressBrand"><span class="progressMark">G</span>GoJet</div>
    <div class="progressMetaBadge">安全安装向导 · 可恢复进度</div>
  </header>
  <section class="progressFrame">
    <aside class="progressRail">
      <h2>安装进度</h2>
      <div class="progressSteps">
        <div class="progressStep"><span>✓</span>环境检查</div>
        <div class="progressStep"><span>✓</span>数据连接</div>
        <div class="progressStep"><span>✓</span>站点设置</div>
        <div class="progressStep"><span>✓</span>系统安装</div>
      </div>
      <div class="progressRailNote"><b>不重复提交</b>安装任务已经交给服务器执行。刷新页面、短暂断网或重新打开此地址，只会恢复状态显示，不会创建第二个安装任务。</div>
    </aside>
    <section class="progressMain">
      <div class="progressStage" data-install-progress>
        <div class="orb" aria-hidden="true"></div>
        <div class="progressKicker">INSTALLATION IN PROGRESS</div>
        <h1>正在完成 GoJet 安装</h1>
        <p class="progressLead" id="installMessage">正在连接安装状态，请保持此页面打开。</p>
        <div class="track"><div class="bar" id="installProgressBar"></div></div>
        <div class="progressStatus"><strong id="installPhase">正在同步安装状态…</strong><span id="installPercent">0%</span></div>
        <div class="sync" id="installSync">安装任务已由服务器接管。页面刷新或连接中断不会重新提交任务。</div>
        <div class="progressActions"><button class="btn secondary" type="button" id="installReconnect" hidden>立即重连</button></div>
        <p class="recovery">如果浏览器与服务器的状态通道暂时中断，本页会自动退避重连并继续读取服务器上的真实进度。请勿重复运行安装命令或重复提交安装表单。</p>
      </div>
    </section>
  </section>
</main>
<script src="/install/install.js"></script>
</body>
</html>
HTML;
    exit;
}

if (gojetInstallerActive($state)) {
    gojetRenderInstallerProgress();
}

ob_start();
require $root . '/installer/index.php';
$html = (string)ob_get_clean();

// The POST that starts installation may have moved request.ready to
// request.processing before this wrapper regains control. Always switch to the
// resumable progress view rather than keeping the one-shot inline poller.
if (gojetInstallerActive($state) || str_contains($html, 'id="bar"')) {
    gojetRenderInstallerProgress();
}

// Keep the original PHP install workflow intact while applying the upgraded
// visual layer to all four wizard steps.
$assets = '<link rel="stylesheet" href="/install/install.css"><link rel="stylesheet" href="/install/wizard.css">';
$html = str_replace('</head>', $assets . '</head>', $html);
echo $html;
