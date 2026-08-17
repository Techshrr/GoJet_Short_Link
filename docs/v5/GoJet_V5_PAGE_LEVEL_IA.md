# GoJet V5 Website / Docs / Workspace / Admin 页面级 IA
**文档编号：GJ-V5-003**  
**状态：FROZEN PAGE ARCHITECTURE**  
**用途：页面、路由、Shell、组件、尺寸、主任务与状态的实施蓝图。**

---

# 1. 路由总图

```text
/
├── products/*
├── solutions/*
├── developers
├── pricing
├── security
├── guides/*
├── about
├── contact
├── legal/*
│
├── login
├── register
├── verify-email
├── forgot-password
├── reset-password
├── invite/*
│
├── docs/
│
├── app/*
│
├── admin/*
│
├── api/*
│
└── install/*
```

---

# 2. Website Shell

## Desktop
```text
64 Header
┌──────────────────────────────────────────────────────────┐
│ Logo   Products  Solutions  Developers  Pricing  Docs   │
│                                      Sign in  Get started│
└──────────────────────────────────────────────────────────┘
```

Header：
- height 64；
- max 1280；
- horizontal padding 24/32；
- Logo 30px；
- nav gap 28–32；
- sticky after 80px scroll；
- translucent surface + 1px border；
- 不长期使用 heavy blur。

Mobile：
- height 60；
- Logo；
- Sign in 可隐藏到 menu；
- Get started 保留；
- Menu icon；
- Full-height sheet。

---

# 3. Website 首页 `/`

## 3.1 Hero
Desktop：
- max width 1280；
- 2-column 46/54；
- min-height 680；
- top/bottom 96；
- title max 620；
- right stage 640–700。

Left：
1. eyebrow；
2. H1；
3. lead；
4. CTA group；
5. trust microcopy。

Right：
- Workspace real UI；
- QR floating card；
- Analytics floating card；
- Jet Path；
- ambient breathing halo。

CTA：
- Primary：Get started；
- Secondary：View demo / Explore products。

## 3.2 Capability Ribbon
5 项：
- Links；
- QR；
- Files；
- Text；
- Bio。

图标 + label，不做巨大 Card。

## 3.3 CREATE
Split section：
- 真实创建 Link UI；
- URL → short link 动效；
- 小 QR 自动生成。

## 3.4 CONTROL
展示：
- Custom domain；
- routing；
- A/B；
- access；
- expiry。

用 Jet Path 作为品牌动态。

## 3.5 UNDERSTAND
真实 Analytics Stage：
- trend；
- country；
- device；
- referrer。

数字进入 viewport count-up。

## 3.6 OPERATE
展示：
- workspace switcher；
- members；
- tags/campaign；
- API；
- audit。

## 3.7 Use Cases
三列，但使用摄影/真实视觉：
- Marketing；
- Creators；
- Teams。

## 3.8 Security
暗色 Band：
- Risk；
- ClamAV；
- RBAC；
- Audit；
- Turnstile。

## 3.9 Developer
API request / response code + Webhook。

## 3.10 CTA
大面积留白 + 品牌 Halo 呼吸。

## 3.11 Footer
5 column：
- Products；
- Solutions；
- Developers；
- Resources；
- Company/Legal。

---

# 4. Products Hub `/products`

结构：
1. Hero；
2. Product grid（真实截图 thumbnail）；
3. Create / Control / Understand / Operate 分类；
4. comparison workflow；
5. CTA。

禁止仅做“9 张 icon card”。

---

# 5. `/products/links`

Hero：
- 左文案；
- 右真实 Create Link。

内容：
1. Create fast；
2. custom domains；
3. routing；
4. A/B；
5. access control；
6. analytics；
7. version history；
8. API；
9. related products；
10. CTA。

SEO：
- 独立 title/H1；
- FAQ 只在真实 FAQ 内容存在时；
- Product screenshot alt 描述界面，不堆 keyword。

---

# 6. `/products/qr-codes`

结构：
1. Hero + QR build motion；
2. create；
3. style；
4. logo；
5. download formats；
6. analytics；
7. custom domain relationship；
8. use cases；
9. CTA。

Hero 动效：
QR module 从 20% → 100% 分阶段点亮，不使用随机像素闪烁。

---

# 7. `/products/files`

重点：
1. upload；
2. sharing；
3. expiry/password；
4. scanning/security；
5. download；
6. custom domains；
7. audit；
8. CTA。

视觉：
真实上传 Dropzone + security scan state。

---

# 8. `/products/text-sharing`

重点：
- plain text；
- Markdown；
- code；
- syntax；
- raw；
- password；
- expiry；
- custom domain。

视觉：
真实 editor + public reader。

---

# 9. `/products/link-in-bio`

重点：
- page builder；
- themes；
- social；
- analytics；
- domain；
- SEO controls；
- safety。

视觉：
手机 frame + editor side panel。
此页面允许真实人物/creator photography 作为场景图。

---

# 10. `/products/analytics`

Hero：
真实图表，不使用虚构随机 Dashboard。

Section：
- realtime/near-real-time（以实际能力为准）；
- clicks；
- geolocation；
- device；
- referrer；
- campaigns；
- cross-resource；
- privacy/retention；
- export。

---

# 11. `/products/smart-routing`

核心：
Jet Path 作为主视觉。

展示：
- country；
- device；
- language；
- source；
- A/B；
- fallback。

必须明确 routing 最终由服务端执行。

---

# 12. `/products/custom-domains`

流程图：
1. Add domain；
2. DNS record；
3. Verification；
4. SSL/status；
5. Assign resources。

必须包含真实 DNS example。

---

# 13. Solutions

## `/solutions/marketing`
摄影 + Campaign / UTM / A/B / Analytics。

## `/solutions/creators`
摄影 + Bio / QR / Links / analytics。

## `/solutions/teams`
Workspace / member / role / audit。

## `/solutions/developers`
API / webhook / custom domains / automation。

每页都必须有产品 UI，不做纯营销图库页。

---

# 14. `/pricing`

Page：
1. Hero；
2. Billing toggle；
3. plan cards；
4. comparison matrix；
5. quotas；
6. payment FAQ；
7. CTA。

规则：
- 所有价格来自可配置真实套餐数据；
- 不在静态源码复制另一套价格真相；
- 若 API 构建时不可用，则由 release build 注入 pricing snapshot；
- currency 和 FX 规则明确。

Mobile comparison：
不要强制横向展示 20 列，改 feature groups。

---

# 15. `/security`

结构：
1. Security statement；
2. Account；
3. Platform；
4. Link destination；
5. File；
6. Abuse；
7. Audit；
8. Responsible disclosure / Contact；
9. CTA。

不写未经验证的合规认证 Logo。

---

# 16. `/about`

允许真实摄影。

结构：
- mission；
- product philosophy；
- timeline（真实才写）；
- principles；
- contact。

---

# 17. `/contact`

两列：
- contact categories；
- form。

Turnstile Adaptive。
表单提交真实 backend。
成功状态页面内持续可见，不仅 toast。

---

# 18. Legal

路由：
- `/legal/terms`
- `/legal/privacy`
- `/legal/acceptable-use`
- `/legal/abuse`

布局：
- 760px article；
- sticky ToC；
- last updated；
- print friendly；
- no marketing animation。

---

# 19. Auth Shell

Desktop：
```text
┌────────────────────────────┬────────────────────────────┐
│ Brand / product visual     │ Auth form                  │
│ subtle breathing           │ 420px max                  │
└────────────────────────────┴────────────────────────────┘
```

≥1024：
- 左 46%；
- 右 54%。

<1024：
- 单栏；
- visual 缩成顶部品牌 header。

表单：
- 400–420px；
- input 40；
- button 40；
- gap 16；
- visible labels。

---

# 20. Login `/login`

组件：
- logo；
- H1；
- OAuth providers（后台启用才显示）；
- divider；
- email；
- password；
- forgot；
- Turnstile（策略决定）；
- submit；
- register link。

状态：
- invalid；
- locked；
- rate-limited；
- verification required；
- OAuth error；
- Turnstile error。

---

# 21. Register `/register`

字段：
- display name；
- email；
- email verification flow；
- password；
- terms acceptance；
- Turnstile。

密码 requirement 不使用夸张规则墙；输入后渐进显示。

---

# 22. Docs `/docs/`

## Shell
Desktop：
```text
56 Header
┌────260────┬────────760────────┬────220────┐
│ Sidebar   │ Article           │ On page   │
└───────────┴───────────────────┴───────────┘
```

Header：
- GoJet Docs；
- search；
- language；
- theme；
- Go to Workspace。

Search：
- `⌘K / Ctrl+K`；
- Pagefind；
- keyboard arrows；
- recent query 可选本地保存；
- no analytics personalization 默认。

Sidebar 分组严格按文档 IA。

Article：
- title；
- description；
- badges（API method 等）；
- content；
- code；
- callout；
- steps；
- tabs；
- prev/next；
- last updated。

Right:
- On this page；
- scroll spy。

---

# 23. Docs 首页

Hero：
- “GoJet Documentation”；
- Search；
- quick start cards 3 个；
- product areas；
- developer；
- self-hosting。

不要变成营销首页。

---

# 24. API Reference

API 页布局：
Desktop 可分：
- article 55%；
- request/response 45%。

Method badge：
- GET；
- POST；
- PUT；
- DELETE。

必须列：
- endpoint；
- auth；
- params；
- body；
- examples；
- response；
- errors；
- rate limit（适用）。

Examples：
- curl；
- JavaScript；
- PHP；
- Go（至少核心接口）。

---

# 25. Workspace Shell `/app/*`

Desktop ≥1280：
```text
┌────248────┬────────────────────────────────────────────┐
│ Sidebar   │ 58 Header                                  │
│           ├────────────────────────────────────────────┤
│           │ Content                                    │
└───────────┴────────────────────────────────────────────┘
```

Sidebar：
1. Logo；
2. WorkspaceSwitcher；
3. Create；
4. Nav；
5. bottom: Support / User。

Header：
- breadcrumbs/context；
- global search/command；
- help；
- notifications；
- avatar。

Content：
- max 1480；
- padding 32；
- 1024: 24；
- mobile: 16。

---

# 26. Workspace Navigation

```text
Overview

CREATE
Links
QR Codes
Content
  Files
  Text
  Bio Pages

INSIGHTS
Analytics

MANAGE
Domains
Campaigns
Tags

DEVELOPER
API Keys
Webhooks

WORKSPACE
Members
Billing
Settings

Support
```

Folders 不做一级 sidebar；作为 Links/Content 内部组织能力。

A/B、UTM、Routing、Access 不做一级导航。

---

# 27. Workspace Overview `/app`

不是传统 KPI 卡片墙。

结构：

## Greeting + Create
```text
Good morning
What do you want to create?

[Link] [QR] [File] [Text] [Bio]
```

## Recent
最近资源 list。

## Performance
一个简洁 7d/30d trend，不放 8 张 KPI。

## Attention
需要用户处理：
- domain verification；
- quota；
- failed payment；
- security；
- ticket reply。

## Activity
workspace recent activity。

---

# 28. Links List `/app/links`

PageHeader：
- title；
- count；
- `Create link`。

Toolbar：
- search；
- domain；
- status；
- campaign；
- tag；
- date；
- view；
- columns。

Table columns：
- Link；
- Destination；
- Domain；
- Clicks；
- Status；
- Updated；
- Actions。

Row：
- favicon/icon；
- short URL；
- title；
- destination secondary。

Bulk：
- pause；
- activate；
- tag；
- export；
- delete。

Mobile：
resource list row：
- short URL；
- title；
- status；
- clicks；
- menu。

---

# 29. Create Link

建议使用 right Sheet：
- Desktop width 520–560；
- Mobile full screen。

默认字段：
1. destination；
2. domain；
3. code；
4. title。

Advanced collapsed：
- expiration；
- password；
- click limit；
- one-time；
- campaign/tags。

Routing/A-B 不在首次创建表单展开，创建后去 Detail。

Footer sticky：
Cancel / Create。

---

# 30. Link Detail `/app/links/:id`

Header：
- short URL；
- copy；
- visit；
- status；
- edit；
- more。

Summary：
- destination；
- clicks；
- created；
- domain。

Tabs：
```text
Overview
Analytics
Routing
A/B Test
UTM
Access
QR
Settings
History
```

### Overview
- trend；
- destination；
- campaign/tags；
- quick configuration summary。

### Analytics
resource-scoped。

### Routing
rule builder；
priority order；
fallback；
test rule action。

### A/B
variants；
weight；
total 100；
preview；
status。

### UTM
structured fields + generated destination preview。

### Access
password；
expiry；
max clicks；
one-time。

### QR
live QR；
style；
PNG/SVG/PDF；
analytics link。

### Settings
- title；
- status；
- danger zone。

### History
timeline：
- revision；
- actor；
- reason；
- diff；
- restore。

---

# 31. QR `/app/qr`

List：
- preview；
- name；
- destination；
- scans；
- updated。

Create：
- destination；
- size；
- foreground/background；
- logo；
- error correction（如能力支持）；
- format。

Detail：
- QR preview；
- downloads；
- analytics；
- target；
- status。

---

# 32. Files `/app/files`

List：
- file；
- size；
- status；
- downloads；
- expiry；
- created。

Upload Sheet / Dropzone：
- drag；
- paste；
- browse；
- folder（能力支持）；
- max info；
- scan notice。

状态：
- uploading；
- processing；
- scanning；
- safe；
- review；
- blocked；
- failed。

Public 之前必须 safe。

---

# 33. Text `/app/text`

List：
- title；
- type；
- views；
- expiry；
- created。

Editor：
- plain；
- markdown；
- code；
- language；
- preview；
- password；
- expiry；
- custom code/domain。

---

# 34. Bio `/app/bio`

List：
- preview phone；
- title；
- domain；
- views；
- status。

Editor Desktop：
```text
┌── controls 420 ──┬──── live phone preview ────┐
```

Tabs：
- Content；
- Appearance；
- Social；
- Domain；
- Analytics；
- SEO；
- Settings。

SEO 默认 noindex。

---

# 35. Analytics `/app/analytics`

Header：
- date range；
- compare；
- export。

Filter bar：
- resource；
- domain；
- campaign；
- country；
- device；
- referrer。

Content：
1. Primary trend；
2. Top resources；
3. Referrers；
4. Countries；
5. Devices；
6. Browsers；
7. OS。

不要四个大 Pie Chart。

Mobile 图表减少维度，detail 使用 list。

---

# 36. Domains `/app/domains`

Table：
- domain；
- type；
- DNS；
- SSL；
- status；
- assigned；
- updated。

Add Domain Wizard：
1. hostname；
2. DNS instructions；
3. verify；
4. active。

Detail：
- DNS；
- verification；
- SSL；
- resources；
- redirects/settings；
- danger。

---

# 37. Campaigns `/app/campaigns`

Table：
- campaign；
- resources；
- clicks；
- date；
- status。

Detail：
- resources；
- analytics；
- UTM defaults（若能力支持）。

---

# 38. Tags `/app/tags`

轻量管理页：
- search；
- create；
- color 不允许自定义任意彩虹，仅从 token palette；
- usage count；
- rename；
- merge（能力支持）；
- delete。

---

# 39. API Keys `/app/api-keys`

Table：
- name；
- prefix；
- scope；
- last used；
- created；
- status。

Create：
- name；
- scopes；
- expiry。

Secret 只展示一次。
提供 copy warning。

---

# 40. Webhooks `/app/webhooks`

- endpoint；
- events；
- signing secret；
- status；
- last delivery。

Detail：
- deliveries；
- payload；
- response；
- retry。

Secret 只可 rotate，不可回显原值。

---

# 41. Members `/app/members`

Table：
- user；
- role；
- status；
- joined。

Actions：
- invite；
- role；
- remove。

Invite：
- email；
- role；
- expiry。

---

# 42. Billing `/app/billing`

顶部：
- Current Plan；
- usage；
- renew/period。

Section：
- plans；
- usage quotas；
- payment methods；
- orders/invoices；
- currency。

Primary CTA 永远明确。

支付 pending/failed 不做 optimistic success。

---

# 43. Settings `/app/settings`

二级 nav：
```text
Profile
Security
Sessions
Notifications
Connected Accounts
Workspace
Danger Zone
```

Security：
- password；
- MFA；
- backup codes。

Sessions：
- current；
- device；
- IP metadata；
- last active；
- revoke。

Connected：
- OAuth bind/unbind。

---

# 44. Support `/app/support`

List：
- number；
- subject；
- status；
- priority；
- updated。

New ticket：
- category；
- subject；
- content；
- attachments；
- Turnstile policy。

Thread：
- messages；
- staff/customer distinction；
- attachments；
- status；
- reply。

WHMCS 风格的“工单线程可读性”，但视觉必须是 GoJet Design System。

---

# 45. Admin Shell `/admin/*`

Desktop：
- sidebar 256；
- header 56；
- content padding 24；
- high density。

Navigation：

```text
Overview

CUSTOMERS
Users
Workspaces
Memberships

RESOURCES
Links
Domains
QR Codes
Files
Text
Bio Pages

TRUST & SAFETY
Destination Risk
File Security
Abuse Reports
Security Events

OPERATIONS
Tickets
Announcements
Mail
Jobs
Services

COMMERCE
Plans
Billing
Payments
FX

ACCESS
Administrators
Roles
Permissions
Audit

PLATFORM
General
Official Domains
OAuth
Turnstile
Mail Settings
Templates
Storage
Integrations
```

---

# 46. Admin Overview `/admin`

不是彩色 KPI card wall。

Top metrics（compact 4）：
- active users；
- workspaces；
- redirects；
- risk queue。

Main：
1. service health；
2. risk attention queue；
3. failed jobs；
4. payment failures；
5. ticket SLA；
6. recent admin audit。

---

# 47. Admin Users

Table：
- user；
- email；
- workspaces；
- plan；
- status；
- risk；
- created；
- last login。

Filters：
- status；
- plan；
- verified；
- risk；
- date。

Detail drawer/page：
- identity；
- workspaces；
- billing；
- resources；
- security；
- sessions；
- audit；
- admin actions。

高风险动作必须 reason。

---

# 48. Admin Workspaces

Table：
- workspace；
- owner；
- members；
- plan；
- resources；
- status；
- created。

Detail：
- overview；
- members；
- limits；
- billing；
- resources；
- audit。

---

# 49. Admin Resources

Links / Domains / QR / Text / Bio：

统一模式：
PageHeader → Filters → DataTable → Detail。

Admin 不直接复用客户 page，因为：
- 列不同；
- 权限不同；
- 操作不同；
- 信息密度不同。

---

# 50. Admin Files

重点增加：
- scan status；
- MIME；
- hash；
- owner；
- storage；
- risk；
- downloads。

Detail：
- metadata；
- scan；
- risk；
- audit；
- quarantine/block；
- delete。

不要直接 iframe 渲染危险未知文件。

---

# 51. Destination Risk

Queue：
- state；
- score；
- category；
- source；
- first seen；
- last checked；
- affected resources。

Detail：
- normalized target；
- evidence summary；
- provider；
- decision；
- history；
- affected resources。

用户-facing block/review 页面不得泄漏内部 evidence/provider。

---

# 52. Abuse Reports

Table：
- report ID；
- type；
- target；
- reporter；
- status；
- priority；
- assignee；
- created。

Detail：
- report；
- evidence；
- target state；
- user/workspace；
- related risk；
- internal notes；
- actions；
- audit。

---

# 53. Tickets Admin

左：
ticket list / filters。
右：
thread / detail。

桌面可 split layout。
Tablet/Mobile 进入独立 detail。

字段：
- status；
- priority；
- customer；
- workspace；
- category；
- assignee；
- SLA；
- internal note；
- reply。

---

# 54. Announcements

- title；
- scope；
- start/end；
- status；
- channel；
- content。

Preview 必须同时查看 Website/Workspace banner。

---

# 55. Mail

分：
- Mail Queue；
- Delivery Logs；
- Templates；
- SMTP/Provider settings。

Mail log 不显示完整 secret。

---

# 56. Jobs / Services

Jobs：
- queue；
- job；
- status；
- attempts；
- duration；
- error。

Services：
- 8 service 状态；
- uptime；
- health；
- last restart；
- version。

Admin UI 可以显示 restart 请求入口，但真实 restart 必须强权限、审计，并由服务端受控执行。

---

# 57. Plans

Plan editor：
- name；
- public；
- price；
- currency；
- period；
- quotas；
- features；
- display order。

Pricing 官网读取同一份 plan source。

---

# 58. Payments

Table：
- order；
- user；
- amount；
- channel；
- status；
- provider ref；
- created。

Detail：
- timeline；
- callback；
- signature state；
- amount；
- currency；
- audit。

敏感 payment payload 需 redaction。

---

# 59. FX

- base currency；
- rates；
- provider；
- last update；
- override；
- history。

Manual override 必须 reason + audit。

---

# 60. Administrators / Roles / Permissions

Administrators：
- account；
- role；
- MFA；
- last login；
- status。

Roles：
- name；
- permission count；
- admins。

Permissions：
按 domain 分组：
- users；
- resources；
- security；
- billing；
- platform；
- audit。

Super Admin 不通过前端隐藏实现，后端强制真相。

---

# 61. Audit

高密度 DataTable：
- time；
- actor；
- action；
- resource；
- workspace；
- result；
- IP metadata；
- request ID。

Detail：
- before/after diff；
- reason；
- related event。

禁止在 audit 中泄漏 secret。

---

# 62. Platform General

Sections：
- site identity；
- brand assets；
- public URLs；
- timezone；
- locale；
- signup；
- maintenance；
- legal links。

Logo 上传进入统一品牌资产目录和校验流程。

---

# 63. Official Domains

- hostname；
- type；
- status；
- default；
- HTTPS；
- resource support。

变更影响可能很大，要求二次确认与审计。

---

# 64. OAuth

Provider cards 只在 Admin settings 中允许 card layout，因为对象数量有限。

每个：
- enabled；
- client ID masked；
- callback；
- new login；
- binding；
- health。

Secret 永远 masked/replace。

---

# 65. Turnstile Admin

页面：

```text
Bot Protection

Provider
Site Key
Secret (masked)
Mode

Policy
Login          Adaptive
Register       Always
Forgot         Adaptive
Reset          Always
Ticket         Adaptive
Contact        Adaptive
Abuse          Always
File Upload    Adaptive

Recent Verification Health
```

Server-side verification health 必须可见。

---

# 66. Mail Templates

List：
- key；
- locale；
- subject；
- enabled；
- updated。

Editor：
- subject；
- HTML；
- text；
- variables；
- preview；
- test send。

必须检测未声明变量/缺失变量。

---

# 67. Storage

- backend；
- root/path/bucket；
- quota；
- health；
- public namespace；
- private namespace；
- temp；
- generated QR；
- file quarantine。

Storage secret 不回显。

---

# 68. Install UI `/install`

独立 InstallShell，不复用 Marketing。

Steps：
1. Welcome；
2. Environment；
3. DB / Redis；
4. Site；
5. Admin；
6. Service setup；
7. Health；
8. Complete。

每步：
- progress；
- clear error；
- retry；
- sensitive field masked。

安装完成：
- lock；
- `/install` disable；
- CTA Admin Login。

SEO：
`X-Robots-Tag: noindex, nofollow`。

---

# 69. Error Pages

必须设计：
- 400；
- 401；
- 403；
- 404；
- 409；
- 429；
- 500；
- maintenance；
- link unavailable；
- file blocked；
- risk review。

Website 404 可有轻微 Jet Path 动效。
Admin/Workspace error 不做营销插画。

---

# 70. Notification / Global Feedback

Workspace Header notifications：
- system；
- billing；
- domain；
- ticket；
- security。

Toast 只用于短暂成功提示。
需要用户处理的问题必须有 persistent state。

---

# 71. Search / Command

Workspace：
`⌘K`
- create；
- navigate；
- search links/files；
- domains；
- help。

Admin：
`⌘K`
- navigate；
- users；
- workspace；
- resource ID；
- ticket；
- audit request ID。

Docs：
`⌘K`
全文内容搜索。

三者实现不同数据源，但交互一致。

---

# 72. Page State Contract

任何资源页必须逐项实现：

```text
Loading
Empty
Error
Partial Error
Success
Read-only
Permission Denied
Quota Exceeded
Rate Limited
Disabled
Destructive Confirm
```

没有这些状态的页面不能 DONE。

---

# 73. Final Visual Acceptance

每一个核心页面都必须保存：

```text
desktop-1440x900.png
tablet-1024x768.png
mobile-390x844.png
```

Website 核心页面额外保存：
- 1920 desktop；
- reduced-motion；
- dark（如适用）。

验收必须检查：
- 是否像同一个 GoJet；
- 是否真实使用产品 UI；
- 是否有足够视觉层次；
- 是否不是卡片墙；
- 是否不是静态干瘪页面；
- 是否没有过度动画；
- 是否没有低质量图片；
- 是否没有占位 icon；
- 是否所有响应式都重新排布而非压缩。
