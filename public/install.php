<?php

$installed = is_file(__DIR__.'/../storage/app/installed.json');
if ($installed) {
    header('Location: /', true, 302);
    exit;
}

$acceptLanguage = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
$english = str_starts_with($acceptLanguage, 'en');
$text = $english ? [
    'title' => 'GoJet installation entry',
    'checking' => 'Checking URL rewriting…',
    'ready' => 'URL rewriting is active. Opening the installer…',
    'failed' => 'URL rewriting is not configured yet.',
    'description' => 'Set the website document root to the project public directory, then add the following Nginx rewrite rule in your control panel:',
    'button' => 'Open installer',
    'retry' => 'Check again',
    'root' => 'Website document root',
] : [
    'title' => 'GoJet 安装入口',
    'checking' => '正在检测 URL 重写 / 伪静态…',
    'ready' => '伪静态配置正常，正在进入安装向导…',
    'failed' => '当前尚未正确配置 URL 重写 / 伪静态。',
    'description' => '请先将网站运行目录设置为项目的 public 目录，然后在宝塔或 Nginx 站点配置中填写以下规则：',
    'button' => '进入安装向导',
    'retry' => '重新检测',
    'root' => '网站运行目录',
];
?><!doctype html>
<html lang="<?= $english ? 'en' : 'zh-CN' ?>">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= htmlspecialchars($text['title']) ?></title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 20% 0,#e4f8ff,transparent 34rem),#f7f9fc;color:#15233b;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:min(720px,100%);border:1px solid #dfe6f0;border-radius:26px;background:rgba(255,255,255,.94);padding:36px;box-shadow:0 28px 90px rgba(38,65,105,.15)}.brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:850}.logo{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(145deg,#42c9dd,#645cf0);color:#fff}.status{margin-top:28px;padding:18px;border-radius:15px;background:#f3f6fa;line-height:1.7}.status.error{background:#fff3f3;color:#973645}.detail{display:none;margin-top:20px}.detail.show{display:block}code{display:block;margin-top:14px;padding:16px;border-radius:13px;background:#101a2d;color:#dbeafe;overflow:auto;white-space:pre-wrap}.row{margin-top:18px;padding:14px;border:1px solid #e1e7ef;border-radius:13px}.row b{display:block;margin-bottom:5px}.actions{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}a,button{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:0;border-radius:11px;padding:0 17px;background:#142744;color:#fff;text-decoration:none;font-weight:800;cursor:pointer}.secondary{background:#e9eef5;color:#33425a}@media(max-width:560px){.card{padding:24px}}</style>
</head>
<body><main class="card"><div class="brand"><span class="logo">G</span>GoJet</div><div id="status" class="status"><?= htmlspecialchars($text['checking']) ?></div><div id="detail" class="detail"><p><?= htmlspecialchars($text['description']) ?></p><div class="row"><b><?= htmlspecialchars($text['root']) ?></b><span><?= htmlspecialchars(dirname(__DIR__).'/public') ?></span></div><code>location / {
    try_files $uri $uri/ /index.php?$query_string;
}</code><div class="actions"><button class="secondary" onclick="checkRewrite()"><?= htmlspecialchars($text['retry']) ?></button><a href="/install"><?= htmlspecialchars($text['button']) ?></a></div></div></main>
<script>
const copy = <?= json_encode($text, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
async function checkRewrite(){const status=document.getElementById('status');const detail=document.getElementById('detail');status.className='status';status.textContent=copy.checking;detail.className='detail';try{const response=await fetch('/install/requirements',{method:'GET',headers:{'X-GoJet-Installer-Probe':'1'},cache:'no-store'});if(response.ok){status.textContent=copy.ready;setTimeout(()=>location.href='/install',500);return}}catch(error){}status.textContent=copy.failed;status.className='status error';detail.className='detail show'}
checkRewrite();
</script></body></html>
