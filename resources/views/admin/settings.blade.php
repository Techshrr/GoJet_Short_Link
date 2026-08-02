<x-layouts.admin title="系统设置" eyebrow="配置中心">
  @php
    $sections = [
      'general'=>['基础信息','网站名称、联系方式与法律主体','⌂'],
      'branding'=>['品牌资产','Logo、图标、分享图片和品牌颜色','✦'],
      'seo'=>['SEO 与分享','标题、描述、关键词和验证代码','⌁'],
      'mail'=>['邮件系统','SMTP、测试、日志和失败诊断','✉'],
      'authentication'=>['注册与认证','注册、邮箱验证、密码和 Turnstile','♙'],
      'links'=>['短链接策略','域名、短码、跳转与安全规则','↗'],
      'analytics'=>['统计与隐私','事件管道、保留周期和访客规则','⌁'],
      'storage'=>['存储与功能','文件策略、扫描和模块开关','⇩'],
      'maintenance'=>['维护模式','维护公告、登录通道和重试时间','◷'],
      'advanced'=>['高级设置','后台路径、环境和缓存','⚙'],
    ];
    $identity=$settings['identity']; $branding=$settings['branding']; $seo=$settings['seo']; $legal=$settings['legal'];
    $mail=$settings['mail']; $auth=$settings['auth']; $links=$settings['links']; $analytics=$settings['analytics']; $storage=$settings['storage']; $maintenance=$settings['maintenance']; $features=$settings['features'];
    $asset = fn($path) => app(\App\Services\SiteConfiguration::class)->assetUrl($path);
  @endphp
  <div class="settings-shell">
    <aside class="settings-nav">
      <div><span>系统设置</span><h1>配置中心</h1><p>所有网站级设置在这里集中管理，保存后立即应用。</p></div>
      <nav>@foreach($sections as $key=>$item)<a href="{{ route('admin.settings.index',['section'=>$key]) }}" class="{{ $section===$key?'active':'' }}"><i>{{ $item[2] }}</i><span><strong>{{ $item[0] }}</strong><small>{{ $item[1] }}</small></span><b>→</b></a>@endforeach</nav>
    </aside>

    <section class="settings-content">
      <div class="settings-head"><div><span>{{ $sections[$section][0] }}</span><h2>{{ $sections[$section][1] }}</h2></div><div class="settings-health"><i class="{{ $mailReady?'ok':'warn' }}"></i><span>邮件系统 {{ $mailReady?'已配置':'未就绪' }}</span></div></div>

      @if($section==='general')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','general') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>网站身份</h3><p>这些内容会显示在导航、标题、邮件和页脚。</p></div></div><div class="form-grid two">
            <label><span>网站名称</span><input class="input" name="site_name" value="{{ old('site_name',$identity['site_name']) }}" required></label>
            <label><span>网站简称</span><input class="input" name="site_short_name" value="{{ old('site_short_name',$identity['site_short_name']) }}" required></label>
            <label class="full"><span>品牌标语</span><input class="input" name="tagline" value="{{ old('tagline',$identity['tagline']) }}" required></label>
            <label class="full"><span>网站描述</span><textarea class="input" rows="3" name="description" required>{{ old('description',$identity['description']) }}</textarea></label>
            <label><span>支持邮箱</span><input class="input" type="email" name="support_email" value="{{ old('support_email',$identity['support_email']) }}" required></label>
            <label><span>联系邮箱</span><input class="input" type="email" name="contact_email" value="{{ old('contact_email',$identity['contact_email']) }}" required></label>
            <label><span>默认语言</span><select class="input" name="locale"><option value="zh_CN" @selected($identity['locale']==='zh_CN')>简体中文</option><option value="en" @selected($identity['locale']==='en')>English</option></select></label>
            <label><span>时区</span><input class="input" name="timezone" value="{{ old('timezone',$identity['timezone']) }}" required></label>
            <label class="full"><span>页脚简介</span><input class="input" name="footer_text" value="{{ old('footer_text',$identity['footer_text']) }}"></label>
          </div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>法律主体</h3><p>用于页脚、隐私政策、服务条款和系统邮件。</p></div></div><div class="form-grid two">
            <label><span>公司 / 运营主体</span><input class="input" name="company" value="{{ old('company',$legal['company']) }}"></label>
            <label><span>登记编号</span><input class="input" name="registration_number" value="{{ old('registration_number',$legal['registration_number']) }}"></label>
            <label class="full"><span>地址</span><textarea class="input" rows="2" name="address">{{ old('address',$legal['address']) }}</textarea></label>
            <label><span>隐私事务邮箱</span><input class="input" type="email" name="privacy_email" value="{{ old('privacy_email',$legal['privacy_email']) }}"></label>
            <label><span>版权文案</span><input class="input" name="copyright" value="{{ old('copyright',$legal['copyright']) }}"></label>
          </div></div>
          <div class="settings-savebar"><span>保存后会清理配置与视图缓存。</span><button class="btn-primary">保存基础信息</button></div>
        </form>
      @elseif($section==='branding')
        <form class="settings-form" method="post" enctype="multipart/form-data" action="{{ route('admin.settings.update','branding') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>品牌颜色</h3><p>控制公开网站和系统邮件中的主要视觉强调。</p></div></div><div class="color-grid"><label><span>品牌主色</span><div><input type="color" name="brand_color" value="{{ $branding['brand_color'] }}"><input class="input" value="{{ $branding['brand_color'] }}" readonly></div></label><label><span>辅助强调色</span><div><input type="color" name="accent_color" value="{{ $branding['accent_color'] }}"><input class="input" value="{{ $branding['accent_color'] }}" readonly></div></label></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>Logo 与图标</h3><p>上传后前台、控制台和浏览器图标会立即更新。</p></div></div><div class="asset-grid">
            @foreach([
              'logo'=>['主 Logo','建议横向透明 PNG / SVG，最大 4 MB'],
              'logo_dark'=>['深色背景 Logo','用于深色页脚或邮件模板'],
              'logo_mark'=>['方形图标','建议 512×512，用于控制台和移动端'],
              'favicon'=>['Favicon','支持 ICO、PNG、WEBP、SVG'],
              'apple_touch_icon'=>['Apple Touch Icon','建议 180×180 PNG'],
              'mail_logo'=>['邮件 Logo','建议宽度 240px 以内'],
            ] as $field=>$info)
              <label class="asset-upload"><div class="asset-preview">@if($asset($branding[$field]??null))<img src="{{ $asset($branding[$field]) }}" alt="">@else<span>＋</span>@endif</div><div><strong>{{ $info[0] }}</strong><small>{{ $info[1] }}</small><input type="file" name="{{ $field }}" accept="image/*,.ico"></div></label>
            @endforeach
          </div></div>
          <div class="settings-card"><div class="settings-card-title"><span>03</span><div><h3>社交分享图片</h3><p>用于 Open Graph、社交媒体预览和默认内容封面。</p></div></div><label class="wide-upload">@if($asset($branding['og_image']??null))<img src="{{ $asset($branding['og_image']) }}" alt="">@else<div><span>＋</span><strong>上传 1200×630 分享图片</strong></div>@endif<input type="file" name="og_image" accept="image/png,image/jpeg,image/webp"></label></div>
          <div class="settings-savebar"><span>上传新文件时会删除旧文件，避免无效资产堆积。</span><button class="btn-primary">保存品牌资产</button></div>
        </form>
      @elseif($section==='seo')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','seo') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>默认搜索信息</h3><p>各页面未提供独立设置时使用这些默认内容。</p></div></div><div class="form-grid">
            <label><span>默认页面标题</span><input class="input" name="default_title" value="{{ old('default_title',$seo['default_title']) }}" required></label>
            <label><span>标题模板</span><input class="input" name="title_template" value="{{ old('title_template',$seo['title_template']) }}" required><small>可用变量：%s 页面标题，%site% 网站名称</small></label>
            <label><span>Meta Description</span><textarea class="input" rows="3" name="seo_description" required>{{ old('seo_description',$seo['description']) }}</textarea></label>
            <label><span>Meta Keywords</span><textarea class="input" rows="2" name="keywords">{{ old('keywords',$seo['keywords']) }}</textarea></label>
            <label><span>Robots</span><input class="input" name="robots" value="{{ old('robots',$seo['robots']) }}" required></label>
          </div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>搜索引擎验证</h3><p>填写平台提供的验证 Token，不要粘贴完整 HTML 标签。</p></div></div><div class="form-grid two"><label><span>Google Site Verification</span><input class="input" name="google_site_verification" value="{{ old('google_site_verification',$seo['google_site_verification']) }}"></label><label><span>百度站点验证</span><input class="input" name="baidu_site_verification" value="{{ old('baidu_site_verification',$seo['baidu_site_verification']) }}"></label></div></div>
          <div class="seo-preview"><small>搜索结果预览</small><h3>{{ $seo['default_title'] }}</h3><a>{{ config('app.url') }}</a><p>{{ $seo['description'] }}</p></div>
          <div class="settings-savebar"><span>Canonical URL 和 Open Graph 会自动生成。</span><button class="btn-primary">保存 SEO 设置</button></div>
        </form>
      @elseif($section==='mail')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','mail') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>SMTP 连接</h3><p>密码加密保存。留空密码表示保留当前值。</p></div><span class="{{ $mailReady?'badge-success':'badge-warning' }}">{{ $mailReady?'已验证':'待测试' }}</span></div><div class="form-grid two">
            <label><span>SMTP 主机</span><input class="input" name="host" value="{{ old('host',$mail['host']) }}" required></label>
            <label><span>端口</span><input class="input" type="number" name="port" value="{{ old('port',$mail['port']) }}" required></label>
            <label><span>加密方式</span><select class="input" name="encryption"><option value="tls" @selected($mail['encryption']==='tls')>TLS / STARTTLS</option><option value="ssl" @selected($mail['encryption']==='ssl')>SSL</option><option value="none" @selected($mail['encryption']==='none')>无加密（不推荐）</option></select></label>
            <label><span>EHLO 域名</span><input class="input" name="ehlo_domain" value="{{ old('ehlo_domain',$mail['ehlo_domain']) }}"></label>
            <label><span>用户名</span><input class="input" name="username" value="{{ old('username',$mail['username']) }}" autocomplete="off"></label>
            <label><span>密码</span><input class="input" type="password" name="password" placeholder="已保存时留空" autocomplete="new-password"></label>
            <label><span>发件邮箱</span><input class="input" type="email" name="from_address" value="{{ old('from_address',$mail['from_address']) }}" required></label>
            <label><span>发件人名称</span><input class="input" name="from_name" value="{{ old('from_name',$mail['from_name']) }}" required></label>
            <label><span>回复邮箱</span><input class="input" type="email" name="reply_to" value="{{ old('reply_to',$mail['reply_to']) }}"></label>
          </div></div>
          <div class="settings-savebar"><span>先保存 SMTP 配置，再发送测试邮件。</span><button class="btn-primary">保存邮件设置</button></div>
        </form>
        <div class="settings-card mail-test-card"><div><span>连接测试</span><h3>发送一封真实测试邮件</h3><p>系统会捕获连接、认证、TLS 和发件人错误，不会把异常直接显示成 500 页面。</p></div><form method="post" action="{{ route('admin.settings.mail.test') }}">@csrf<input class="input" type="email" name="recipient" value="{{ auth()->user()->email }}" required><button class="btn-secondary">发送测试邮件</button></form></div>
        <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>最近邮件日志</h3><p>失败原因保留在后台，便于诊断和恢复。</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>时间</th><th>类型</th><th>收件人</th><th>状态</th><th>尝试</th><th>详情 / 操作</th></tr></thead><tbody>@forelse($mailLogs as $log)<tr><td>{{ $log->last_attempt_at?->format('m-d H:i:s') ?? $log->created_at?->format('m-d H:i:s') }}</td><td>{{ $log->message_type }}</td><td>{{ $log->recipient }}</td><td><span class="{{ $log->status==='sent'?'badge-success':'badge-danger' }}">{{ $log->status==='sent'?'已发送':'失败' }}</span></td><td>{{ $log->attempts }}</td><td class="max-w-md break-words"><div class="mail-log-detail"><span>{{ $log->error_message ?: '邮件传输已接受' }}</span>@if($log->status==='failed')<form method="post" action="{{ route('admin.settings.mail.retry',$log) }}">@csrf<button class="text-action">立即重试</button></form>@endif</div></td></tr>@empty<tr><td colspan="6" class="empty-cell">暂无邮件日志</td></tr>@endforelse</tbody></table></div></div>
      @elseif($section==='authentication')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','authentication') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>注册与邮箱验证</h3><p>强制验证只有在 SMTP 已配置并测试后才能开启。</p></div></div><div class="toggle-list"><label><input type="checkbox" name="allow_registration" value="1" @checked($auth['allow_registration'])><span><strong>开放用户注册</strong><small>关闭后仅现有用户和邀请成员可以登录。</small></span></label><label><input type="checkbox" name="require_email_verification" value="1" @checked($auth['require_email_verification'])><span><strong>强制邮箱验证</strong><small>未验证用户不能进入控制台。当前 SMTP：{{ $mailReady?'已就绪':'未就绪' }}。</small></span></label><label><input type="checkbox" name="allow_password_reset" value="1" @checked($auth['allow_password_reset'])><span><strong>允许找回密码</strong><small>同样依赖邮件系统。</small></span></label></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>密码与验证码</h3><p>控制账户创建和登录保护。</p></div></div><div class="form-grid two"><label><span>最小密码长度</span><input class="input" type="number" name="password_min_length" min="8" max="128" value="{{ $auth['password_min_length'] }}" required></label><label class="toggle-row"><input type="checkbox" name="turnstile_enabled" value="1" @checked($auth['turnstile_enabled'])><span><strong>启用 Cloudflare Turnstile</strong><small>用于登录、注册和找回密码。</small></span></label><label><span>Site Key</span><input class="input" name="turnstile_site_key" value="{{ $auth['turnstile_site_key'] }}"></label><label><span>Secret Key</span><input class="input" type="password" name="turnstile_secret_key" value="" placeholder="已保存时留空" autocomplete="new-password"></label><label class="full"><span>禁止注册的邮箱域名</span><textarea class="input" rows="3" name="blocked_email_domains">{{ implode("\n",$auth['blocked_email_domains']??[]) }}</textarea><small>每行一个，或使用逗号分隔。</small></label></div></div>
          <div class="settings-savebar"><span>认证策略变更会影响后续请求，不会强制退出当前用户。</span><button class="btn-primary">保存认证设置</button></div>
        </form>
      @elseif($section==='links')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','links') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>默认链接策略</h3><p>新建链接会使用这些默认值，用户仍可在权限范围内修改。</p></div></div><div class="form-grid two"><label><span>默认短链域名</span><input class="input" name="default_host" value="{{ $links['default_host'] }}" required></label><label><span>默认短码长度</span><input class="input" type="number" min="3" max="32" name="short_code_length" value="{{ $links['short_code_length'] }}" required></label><label><span>默认跳转状态码</span><select class="input" name="default_redirect_type">@foreach([301,302,307,308] as $code)<option value="{{ $code }}" @selected($links['default_redirect_type']===$code)>{{ $code }}</option>@endforeach</select></label><label><span>默认有效期（天）</span><input class="input" type="number" min="1" max="3650" name="default_expiration_days" value="{{ $links['default_expiration_days'] }}" placeholder="留空表示永久"></label></div><div class="toggle-list compact"><label><input type="checkbox" name="force_https" value="1" @checked($links['force_https'])><span><strong>强制 HTTPS 短链</strong><small>生成和展示短地址时使用 HTTPS。</small></span></label><label><input type="checkbox" name="safety_check" value="1" @checked($links['safety_check'])><span><strong>目标地址安全检查</strong><small>阻止私网、黑名单与风险目标。</small></span></label></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>保留短码</h3><p>这些路径不会被用户注册为短链接。</p></div></div><textarea class="input font-mono" rows="10" name="reserved_words">{{ implode("\n",$links['reserved_words']??[]) }}</textarea></div>
          <div class="settings-savebar"><span>修改默认域名不会改变已经创建的链接。</span><button class="btn-primary">保存链接策略</button></div>
        </form>
      @elseif($section==='analytics')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','analytics') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>事件管道</h3><p>Laravel 路径同步落库；Go 跳转面先写入持久化磁盘队列，再同步投递到控制面，故障恢复后自动重试。</p></div></div><div class="form-grid two"><label class="toggle-row"><input type="checkbox" name="enabled" value="1" @checked($analytics['enabled'])><span><strong>启用访问统计</strong><small>关闭后仍跳转，但不记录新事件。</small></span></label><div class="pipeline-note"><strong>当前统计路径</strong><code>{{ config('gojet.redirect_plane.enabled') ? 'Go durable spool + Laravel fallback' : 'Laravel synchronous persistence' }}</code><small>统计路径由部署拓扑决定，后台不提供会造成配置与 Nginx 实际路由不一致的假开关。</small></div><label><span>事件保留天数</span><input class="input" type="number" min="7" max="3650" name="retention_days" value="{{ $analytics['retention_days'] }}" required></label><div class="pipeline-note"><strong>独立访客规则</strong><code>每个链接 · 每个自然日 · 隐私哈希访客</code><small>同一访客同一天重复访问只计一次独立访客。</small></div><label class="toggle-row"><input type="checkbox" name="reconciliation_enabled" value="1" @checked($analytics['reconciliation_enabled'] ?? true)><span><strong>启用计数对账</strong><small>周期性核对链接计数、事件表与未处理失败记录。</small></span></label><div class="pipeline-note"><strong>耐久队列目录</strong><code>GOJET_REDIRECT_SPOOL_DIR</code><small>由部署环境配置并挂载持久化卷，不在网页端修改服务器路径。</small></div></div><div class="toggle-list compact"><label><input type="checkbox" name="store_referrer_url" value="1" @checked($analytics['store_referrer_url'])><span><strong>保存完整 Referer URL</strong><small>用于更细粒度的来源分析。</small></span></label><label><input type="checkbox" name="store_city" value="1" @checked($analytics['store_city'])><span><strong>保存城市信息</strong><small>仅在上游代理提供城市头时可用。</small></span></label><label><input type="checkbox" name="exclude_bots_from_unique" value="1" @checked($analytics['exclude_bots_from_unique'])><span><strong>机器人不计入独立访客</strong><small>机器人访问仍单独保留和展示。</small></span></label></div></div>
          <div class="pipeline-diagram"><div><b>访问请求</b><small>Laravel / Go</small></div><i>→</i><div><b>先保证不丢</b><small>Laravel 事务 / Go fsync spool</small></div><i>→</i><div><b>事件持久化</b><small>幂等写入 MySQL</small></div><i>→</i><div><b>报表与导出</b><small>真实数据</small></div></div>
          <div class="settings-savebar"><span>Go 跳转面启用后必须挂载持久化 spool 卷；Laravel 路径不依赖队列即可记录核心统计。</span><button class="btn-primary">保存统计设置</button></div>
        </form>
      @elseif($section==='storage')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','storage') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>文件存储策略</h3><p>控制分享文件的磁盘、大小、扩展名和扫描。</p></div></div><div class="form-grid two"><label><span>存储磁盘</span><select class="input" name="disk">@foreach($storageDisks as $disk)<option value="{{ $disk }}" @selected($storage['disk']===$disk)>{{ $disk }}</option>@endforeach</select></label><label><span>最大上传 MB</span><input class="input" type="number" min="1" max="10240" name="max_upload_mb" value="{{ $storage['max_upload_mb'] }}" required></label><label class="full"><span>允许的扩展名</span><textarea class="input" rows="3" name="allowed_extensions">{{ implode(', ',$storage['allowed_extensions']??[]) }}</textarea><small>留空表示使用系统安全策略，不额外限制扩展名。</small></label><label class="toggle-row full"><input type="checkbox" name="malware_scan" value="1" @checked($storage['malware_scan'])><span><strong>启用恶意文件扫描</strong><small>需要部署并配置 ClamAV。</small></span></label></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>产品模块</h3><p>关闭模块会隐藏入口并阻止新建，不会删除已有数据。</p></div></div><div class="feature-toggle-grid">@foreach(['links'=>'短链接','smart_routing'=>'智能路由','texts'=>'文本分享','files'=>'文件分享','profiles'=>'个人主页','teams'=>'团队工作区','webhooks'=>'Webhook','sso'=>'企业 SSO'] as $key=>$label)<label><input type="checkbox" name="feature_{{ $key }}" value="1" @checked($features[$key]??false)><span><strong>{{ $label }}</strong><small>{{ ($features[$key]??false)?'已启用':'已关闭' }}</small></span></label>@endforeach</div></div>
          <div class="settings-savebar"><span>关闭核心链接模块会影响公开创建和控制台入口。</span><button class="btn-primary">保存存储与功能</button></div>
        </form>
      @elseif($section==='maintenance')
        <form class="settings-form" method="post" action="{{ route('admin.settings.update','maintenance') }}">@csrf @method('patch')
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>计划维护</h3><p>开启后公开站和用户控制台返回标准 503，管理员入口保持可用。</p></div><span class="{{ $maintenance['enabled']?'badge-warning':'badge-success' }}">{{ $maintenance['enabled']?'维护中':'正常服务' }}</span></div><div class="toggle-list"><label><input type="checkbox" name="enabled" value="1" @checked($maintenance['enabled'])><span><strong>启用维护模式</strong><small>不会停止队列、跳转面或后台任务。</small></span></label><label><input type="checkbox" name="allow_login" value="1" @checked($maintenance['allow_login'])><span><strong>保留登录与找回密码入口</strong><small>方便管理员和已授权成员进入系统。</small></span></label></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>维护页面</h3><p>向访问者解释当前状态，并通过 Retry-After 告知合理重试时间。</p></div></div><div class="form-grid"><label><span>维护提示</span><textarea class="input" rows="5" name="message" required>{{ old('message',$maintenance['message']) }}</textarea></label><label><span>Retry-After（秒）</span><input class="input" type="number" min="60" max="86400" name="retry_after" value="{{ old('retry_after',$maintenance['retry_after']) }}" required></label></div></div>
          <div class="settings-savebar"><span>后台管理员始终不会被维护模式锁在系统外。</span><button class="btn-primary">保存维护设置</button></div>
        </form>
      @else
        <div class="settings-form">
          <div class="settings-card"><div class="settings-card-title"><span>01</span><div><h3>管理后台路径</h3><p>用于降低后台路径被自动扫描的概率。修改后当前地址会立即变化。</p></div></div><div class="current-admin-url"><small>当前地址</small><code>{{ rtrim(config('app.url'),'/') }}/{{ $adminPath }}</code></div>@unless($environmentWritable)<div class="flash-warning">.env 文件不可写，当前无法修改后台路径。</div>@endunless<form class="inline-setting-form" method="post" action="{{ route('admin.settings.admin-path') }}">@csrf @method('patch')<div><span>/</span><input class="input" name="admin_path" value="{{ $adminPath }}" required></div><button class="btn-primary" @disabled(!$environmentWritable)>更新路径</button></form></div>
          <div class="settings-card"><div class="settings-card-title"><span>02</span><div><h3>生产进程</h3><p>跳转、后台任务和计划任务彼此独立，任何故障都必须可以从诊断中心定位。</p></div></div><div class="process-grid"><article><span>Laravel Queue</span><code>php artisan queue:work redis --queue=default</code></article><article><span>Go Redirect Plane</span><code>./gojet-redirector</code></article><article><span>Durable Spool</span><code>/var/lib/gojet/spool</code></article><article><span>Scheduler</span><code>php artisan schedule:work</code></article></div></div>
          <div class="settings-card"><div class="settings-card-title"><span>03</span><div><h3>缓存维护</h3><p>清理配置、路由、视图和应用缓存，不会删除用户数据或统计事件。</p></div></div><form method="post" action="{{ route('admin.settings.cache.clear') }}">@csrf<button class="btn-secondary">清理全部应用缓存</button></form></div>
          <div class="settings-card danger-zone"><div class="settings-card-title"><span>04</span><div><h3>环境信息</h3><p>用于诊断，不会在公开页面显示。</p></div></div><dl><div><dt>应用环境</dt><dd>{{ app()->environment() }}</dd></div><div><dt>Laravel</dt><dd>{{ app()->version() }}</dd></div><div><dt>PHP</dt><dd>{{ PHP_VERSION }}</dd></div><div><dt>队列连接</dt><dd>{{ config('queue.default') }}</dd></div><div><dt>缓存驱动</dt><dd>{{ config('cache.default') }}</dd></div></dl></div>
        </div>
      @endif
    </section>
  </div>
</x-layouts.admin>
