@php($zh=app()->getLocale()==='zh_CN')
<x-product-page
  :kicker="$zh?'GoJet 产品体系':'GoJet product suite'"
  :title="__('v3.public.product_title')"
  :description="__('v3.public.product_subtitle')"
  :features="[
    ['title'=>$zh?'品牌短链接':'Branded short links','description'=>$zh?'批量创建、分类、动态编辑、UTM、二维码、到期、密码和健康检测。':'Create and organize links in bulk with editable destinations, UTM, QR, expiry, passwords, and health checks.'],
    ['title'=>$zh?'智能路由与实验':'Smart routing and experiments','description'=>$zh?'按国家、设备、浏览器、语言、来源、查询参数和时间选择目标，或执行稳定权重实验。':'Route by country, device, browser, language, referrer, query, or schedule, and run stable weighted experiments.'],
    ['title'=>$zh?'隐私友好分析':'Privacy-aware analytics','description'=>$zh?'实时趋势、独立访客、地理位置、设备、浏览器、来源、UTM、二维码和转化事件。':'Realtime trends, unique visitors, geography, devices, browsers, referrers, UTM, QR scans, and conversions.'],
    ['title'=>$zh?'文本与文件分享':'Text and file sharing','description'=>$zh?'安全发布文本、Markdown、代码和文件，支持密码、到期、访问上限、分片上传及 S3 兼容存储。':'Securely publish text, Markdown, code, and files with passwords, expiry, limits, resumable uploads, and S3-compatible storage.'],
    ['title'=>$zh?'品牌个人主页':'Branded profile pages','description'=>$zh?'通过主题、头像、自定义颜色、可排序区块、定时内容和独立域名构建 Link in Bio。':'Build Link-in-Bio pages with themes, avatars, custom colors, sortable blocks, schedules, and branded domains.'],
    ['title'=>$zh?'团队与开发平台':'Teams and developer platform','description'=>$zh?'工作区、角色、套餐配额、版本化 API、可撤销 Token、签名 Webhook、投递日志和运营审计。':'Workspaces, roles, plan quotas, versioned APIs, revocable tokens, signed webhooks, delivery logs, and operational audits.'],
  ]"
  :workflow="[
    ['title'=>$zh?'部署并安装':'Deploy and install','description'=>$zh?'使用宝塔、传统 Nginx/PHP-FPM 或 Docker，在浏览器完成安装。':'Use BaoTa, traditional Nginx/PHP-FPM, or Docker and finish setup in the browser.'],
    ['title'=>$zh?'连接品牌资产':'Connect brand assets','description'=>$zh?'验证域名、建立工作区、邀请成员并配置存储、邮件与 Webhook。':'Verify domains, create workspaces, invite members, and configure storage, email, and webhooks.'],
    ['title'=>$zh?'分发并优化':'Distribute and optimize','description'=>$zh?'发布链接与内容，分析访问和转化，通过路由与实验持续优化。':'Publish links and content, analyze visits and conversions, and optimize with routing and experiments.'],
  ]"
/>
