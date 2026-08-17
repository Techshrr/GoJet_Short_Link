# GoJet V5 产品与技术重构总纲
**文档编号：GJ-V5-001**  
**状态：FROZEN BASELINE（实施前冻结版）**  
**适用范围：GoJet V5 全部产品、设计、前端、后端、部署、测试、SEO、安全与发布工作**  
**基线：`rebuild/v4-rc12-real-install-fixes`**  

> 本文是 GoJet V5 的最高级项目契约。任何页面、组件、功能、部署脚本或发布候选如果与本文冲突，应优先修正实现，而不是修改本文去迁就既有代码。

---

## 1. V5 的定义

GoJet V5 不是“给 V4 换皮”，而是在 **完整保留 V4 已有业务与服务能力** 的基础上，重新建立：

1. 产品信息架构；
2. GoJet 品牌与 Design System；
3. 官网、认证、工作台、管理后台、文档中心；
4. 前端工程体系；
5. SEO / Indexation / Structured Data 体系；
6. UGC 与公开内容边界；
7. 会话、CSRF、CSP、SSRF、上传、风控、审计等安全边界；
8. Native 部署、安装、升级、回滚与发布 Gate；
9. Desktop / Tablet / Mobile 三端一致体验；
10. 可长期迭代且不会再次依赖页面级 CSS/JS 补丁的工程结构。

V5 的最终交付标准不是“接口能通”，而是：

**功能完整 + 产品成熟 + UI 精美 + 品牌统一 + SEO 正确 + 安全正确 + 性能达标 + 真机安装可验收。**

---

## 2. 不可破坏原则

### 2.1 功能不可缩水
以下能力必须作为 V5 的 P0 范围保留或补齐：

- 短链接；
- 自定义短码；
- 自定义域名 / 官方域名；
- 301 / 302 / 307 / 308；
- 密码；
- 到期；
- 点击上限；
- 一次性访问；
- UTM；
- Geo / Device / Language / Source Routing；
- A/B Testing；
- 版本历史 / 变更原因；
- QR；
- Text Sharing；
- File Sharing；
- Link in Bio；
- Analytics；
- Workspace / Members / RBAC；
- Campaign / Folder / Tag；
- Billing / Plans / Quota；
- Orders / Payments / FX；
- Support Tickets；
- Mail / Templates；
- OAuth / Social Login；
- Turnstile；
- Destination Risk；
- Abuse；
- File Security / ClamAV；
- Audit；
- Admin；
- System / Service Status；
- API Keys / Webhooks；
- Native Installer。

### 2.2 服务端是真相
前端权限只控制展示，不能成为安全边界。

所有以下规则必须由 Go API / Worker 最终执行：

- Authentication；
- Authorization；
- Tenant Isolation；
- RBAC；
- Billing / Quota；
- Payment；
- Risk；
- File Security；
- Audit；
- Domain ownership；
- Rate Limit。

### 2.3 不为了 UI 改坏正确的业务逻辑
视觉重构不能成为删除安全约束、审计约束、权限约束和变更原因的理由。

### 2.4 不做“大爆炸式 UI 重构”
V5 必须以 **Design System → Shell → Links Vertical Slice → 扩展其他模块** 的顺序推进。

Links 样板未达到正式视觉与工程标准前，不允许把同一种不成熟模式复制到几十个页面。

---

## 3. 最终生产架构

```text
                         Nginx
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
       Website          Workspace           Admin
       Static/SSG       React SPA          React SPA
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                      Go Platform API
                           │
        ┌──────────┬───────┼────────┬────────────┐
        ▼          ▼       ▼        ▼            ▼
      MySQL      Redis   Workers   Mail        Storage
                                    │
                               Risk / ClamAV

/install/*
    │
    ▼
PHP 8.3 Web Installer
```

### 3.1 生产环境固定
- Nginx；
- PHP 8.3（仅 Installer 与必须的安装入口）；
- MySQL 8.x；
- Redis；
- Go binaries；
- systemd；
- ClamAV（启用文件能力时）。

### 3.2 正式生产链删除
- Docker；
- Docker Compose；
- Node Runtime；
- PM2；
- Node SSR。

### 3.3 Node 只允许存在于
- 开发机；
- GitHub Actions；
- 前端构建；
- 静态预渲染；
- 测试；
- Release packaging。

---

## 4. 前端技术栈冻结

### 4.1 Monorepo
- pnpm workspace；
- TypeScript strict；
- 独立 app build；
- 共享 packages。

### 4.2 Core
- React 19；
- TypeScript；
- Vite；
- Tailwind CSS v4。

### 4.3 Application
- TanStack Router：路由、嵌套 layout、search params；
- TanStack Query：server-state、cache、mutation、invalidations；
- TanStack Table v8：表格、筛选、排序、分页、选择；
- React Hook Form：复杂表单状态；
- Zod：客户端 schema 与表单校验；
- Recharts：控制台图表；
- Motion for React：复杂动效；
- Sonner：Toast；
- cmdk：Command Palette；
- Lucide：产品功能图标。

### 4.4 UI 基础
使用 shadcn 的 open-code 思路和 Base UI primitives，但所有组件必须经过 GoJet 封装。

禁止业务页面直接把上游示例当最终 UI。

---

## 5. 前端目录

```text
frontend/
├── apps/
│   ├── site/
│   │   ├── marketing/
│   │   └── auth/
│   ├── docs/
│   ├── workspace/
│   └── admin/
│
├── packages/
│   ├── ui/
│   ├── tokens/
│   ├── api-client/
│   ├── auth/
│   ├── charts/
│   ├── icons/
│   ├── domain/
│   ├── motion/
│   └── utils/
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 5.1 docs
`apps/docs` 采用 Astro Starlight 静态构建，发布到 `/docs/`，使用 Pagefind 本地全文搜索。

生产服务器仍然只提供静态文件，不运行 Astro/Node 服务。

---

## 6. 五个产品 Surface

V5 实际包含五个明确 Surface：

1. Website；
2. Auth；
3. Docs；
4. Workspace；
5. Admin。

它们共享一套 GoJet Design System，但密度和任务模型不同。

| Surface | 主要目标 | 信息密度 | 表现力 |
|---|---|---:|---:|
| Website | 品牌、搜索、转化 | 低 | 极高 |
| Auth | 安全完成认证 | 低 | 中 |
| Docs | 学习、查询、API 参考 | 中 | 中 |
| Workspace | 创建、运营、分析 | 中高 | 高 |
| Admin | 治理、运营、安全 | 极高 | 低 |

---

## 7. GoJet 品牌定位

品牌关键词固定为：

**Precise · Fast · Controlled · Modern**

中文语义：

**精确、轻快、可控、现代。**

GoJet 不是传统“后台模板”，也不是靠霓虹紫渐变、玻璃拟态和 3D 球体制造高级感的 SaaS 模板。

### 7.1 品牌主色冻结
- Deep Ink：`#0B1220`
- Kinetic Blue：`#2563EB`
- Kinetic Blue Dark：`#1D4ED8`
- Jet Cyan：`#06B6D4`
- Sky Accent：`#38BDF8`
- Canvas Light：`#F7F9FC`
- Surface：`#FFFFFF`
- Canvas Dark：`#070B14`
- Surface Dark：`#0D1422`

品牌色和状态色必须分离。

状态色：
- Success：`#16A34A`
- Warning：`#D97706`
- Danger：`#DC2626`
- Info：`#0EA5E9`

---

## 8. 官网不是静态海报：Motion System

官网必须具备“持续但克制的生命感”。

### 8.1 必须存在的五类动效

#### Ambient Breathing
Hero 背景的蓝/青 Halo 使用 7–10 秒循环呼吸：

- scale：0.98 → 1.03；
- opacity：0.50 → 0.72；
- 位移：2–8px；
- 不使用快速旋转；
- 不制造电竞/游戏感。

#### Product Float
真实产品界面截图或产品 UI Stage：

- 5–7 秒轻微上下漂浮；
- Y 轴范围约 ±6–10px；
- rotate 不超过 ±0.35°；
- 鼠标进入时只做极轻微 perspective。

#### Jet Path
使用 SVG path 表达“创建 → 路由 → 访问 → 分析”：

- 小光点沿 path 移动；
- 4–7 秒；
- 仅使用 1–3 个活动节点；
- 不使用满屏粒子。

#### Scroll Reveal
section 进入 viewport：

- opacity 0 → 1；
- translateY 12–24px → 0；
- 350–600ms；
- stagger 40–80ms。

#### Live Product Micro-interactions
Hero 中真实短链输入、QR、Analytics 数字等：
- URL 输入 → 生成短链；
- QR 从 outline 到完整；
- clicks 数字 count-up；
- A/B 50/50 轻微流动；
- Route 节点随访问方向点亮。

### 8.2 reduced motion
`prefers-reduced-motion: reduce` 时：
- 关闭无限呼吸；
- 关闭 parallax；
- 关闭沿 path 移动；
- 保留简单 opacity transition；
- 不影响信息理解。

### 8.3 性能
无限动效优先使用：
- transform；
- opacity。

避免长时间大面积：
- filter blur 动画；
- box-shadow 动画；
- backdrop-filter 动画。

---

## 9. 图片与视觉素材策略

官网不能“全是代码画出来的抽象矩形”，也不能沦为廉价图库站。

最终素材组成目标：

- 45%：真实 GoJet UI 截图 / 产品 UI Stage；
- 20%：GoJet 自制 SVG / Motion Diagram；
- 20%：真实摄影或场景图；
- 10%：品牌图标 / 合作生态图标；
- 5%：装饰纹理。

### 9.1 产品页面
优先展示真实 GoJet：
- Links；
- QR；
- Analytics；
- Domains；
- Routing；
- Workspace。

禁止画一个不存在的 Dashboard 冒充产品。

### 9.2 实景照片
只用于真正需要人/场景的地方：
- Teams；
- Creators；
- Marketing；
- About / Story。

下载后必须自托管，不允许生产页面 hotlink 第三方图片 CDN。

### 9.3 资产记录
所有外部资产登记：

`frontend/assets/ATTRIBUTION.md`

记录：
- source；
- author；
- license；
- downloaded_at；
- edited；
- usage location。

### 9.4 图片格式
- 主格式 AVIF；
- WebP fallback；
- SVG 用于 Logo/Icon/Diagram；
- explicit width/height；
- responsive srcset；
- below-fold lazy loading；
- LCP 主图禁止 lazy。

---

## 10. 图标系统

### 10.1 功能图标
唯一默认功能图标库：

**Lucide**

规格：
- 常规 UI：16 / 18px；
- Sidebar：18px；
- Empty State：24–32px；
- Marketing feature：20–24px；
- 默认 stroke：1.75；
- 强调状态可到 2。

禁止：
- Emoji 代替正式 icon；
- FontAwesome / Heroicons / Lucide 混用；
- 随手复制网络 SVG。

### 10.2 第三方品牌标
优先级：
1. 官方 Brand Kit；
2. 官方网站提供的 SVG；
3. Simple Icons。

每个品牌 Logo 都要检查商标/品牌规范，不能因为 Simple Icons 包含图标就默认拥有任意商标用途授权。

### 10.3 GoJet 自定义产品 Icon
只有 GoJet 自有概念（如 Jet Path、GoJet mark）允许自绘。

统一：
- 24×24 grid；
- 2px safe area；
- 1.75px stroke；
- round cap / round join。

---

## 11. SEO 作为系统能力

### 11.1 Marketing / Docs
所有希望收录的页面必须 Build-time SSG / Pre-render。

源 HTML 中直接存在：
- title；
- meta description；
- canonical；
- robots；
- H1；
- 主要正文；
- internal links；
- structured data（适用时）。

### 11.2 Index Matrix

| 类型 | Index |
|---|---|
| `/` | index |
| `/products/*` | index |
| `/solutions/*` | index |
| `/pricing` | index |
| `/security` | index |
| `/docs/*` | index |
| `/guides/*` | index |
| `/about` | index |
| `/legal/*` | index |
| `/login` | noindex |
| `/register` | noindex |
| `/forgot-password` | noindex |
| `/app/*` | noindex |
| `/admin/*` | noindex |
| `/install/*` | noindex |
| `/api/*` | noindex |
| Short URL | noindex |
| File share | noindex |
| Text share | noindex |
| Bio | 默认 noindex |

### 11.3 UGC
UGC 永远不进入主站 sitemap。

Bio 默认 noindex；未来若允许 index：
- 用户主动开启；
- 账户经过验证；
- 内容通过 Risk；
- 最好使用 Custom Domain。

### 11.4 Sitemap
Build 时自动生成 canonical URL：
- sitemap.xml；
- sitemap docs；
- hreflang（英文 / zh-CN）；
- 不把 app/admin/auth/UGC 放进 sitemap。

### 11.5 robots
robots.txt 只用于抓取策略，不把它当成 noindex 的替代品。

受认证保护区域：
- Authentication；
- `X-Robots-Tag: noindex, nofollow`。

公开但不收录：
- `<meta name="robots" content="noindex,nofollow">` 或 header。

---

## 12. 语言与国际 SEO

GoJet 国际主站固定：
- 默认：English；
- 中文：`/zh-CN/`。

Docs：
- `/docs/en/`
- `/docs/zh-CN/`

原则：
- URL 显式语言；
- 不根据 IP 强制 302 改语言；
- 提供语言切换；
- canonical 指向当前语言版本；
- hreflang 双向完整；
- `x-default` 指向英文默认首页。

---

## 13. 文档中心

正式地址：

`/docs/`

### 13.1 UI
Desktop：
- 左侧目录：260px；
- Header：56px；
- 正文最大宽度：760px；
- 右侧 On this page：220px；
- 总容器：1440px 内；
- 全文 Search：`⌘/Ctrl + K`。

Tablet：
- 左侧变 Drawer；
- 右 ToC 可折叠。

Mobile：
- 单栏；
- 顶部 Menu + Search；
- page footer 上一篇 / 下一篇。

### 13.2 文档信息架构

```text
Overview

Getting Started
├── Create account
├── Login
├── First workspace
├── Create first link
└── Add custom domain

Core Products
├── Links
├── QR Codes
├── Files
├── Text
├── Bio Pages
└── Analytics

Link Management
├── Custom codes
├── Passwords
├── Expiration
├── Click limits
├── UTM
├── Routing
├── A/B testing
└── Version history

Workspace
├── Members
├── Roles
├── Campaigns
├── Tags
├── Billing
└── Security

Domains
├── Official domains
├── Custom domains
├── DNS verification
└── Troubleshooting

Developers
├── Quick start
├── Authentication
├── API overview
├── Errors
├── Rate limits
├── Webhooks
└── Examples

API Reference
├── Links
├── QR
├── Files
├── Text
├── Bio
├── Domains
├── Analytics
└── Workspace

Integrations
├── Browser extension
├── ShareX
├── WordPress
└── Other integrations

Security
├── Account security
├── Abuse protection
├── File scanning
└── Destination risk

Self-hosting
├── Requirements
├── aaPanel / BT installation
├── Nginx
├── PHP 8.3 installer
├── MySQL 8
├── Redis
├── systemd services
├── ClamAV
├── Backup
├── Upgrade
├── Rollback
└── Troubleshooting

Reference
├── Changelog
├── Limits
└── Status
```

### 13.3 Docs SEO
每篇文档必须有：
- title；
- description；
- lastUpdated；
- canonical；
- breadcrumbs；
- code language；
- page TOC；
- next/previous；
- Edit/View Source（若开放）；
- Pagefind index；
- sitemap。

---

## 14. 安全总纲

### 14.1 Session
优先：
- HttpOnly；
- Secure；
- SameSite；
- host-only Cookie；
- 服务端 session / refresh strategy。

禁止把正式 auth token 放入 localStorage。

### 14.2 CSRF
Cookie Session 下使用：
- SameSite；
- CSRF token；
- Origin/Referer validation。

### 14.3 Security Headers
统一由 Nginx / Go 输出：
- HSTS；
- CSP；
- X-Content-Type-Options；
- Referrer-Policy；
- Permissions-Policy；
- CSP frame-ancestors。

### 14.4 CSP
先 Report-Only，再强制。

严禁：
- `default-src *`；
- 无必要的 `'unsafe-eval'`；
- 为修前端临时放开所有域名。

### 14.5 Turnstile
Admin 中央配置，按场景开关：
- Login；
- Register；
- Forgot；
- Reset；
- Ticket；
- Contact；
- Report Abuse；
- File Upload；
- 高风险敏感操作。

模式：
- Off；
- Adaptive；
- Always。

所有 token 服务器端验证。

### 14.6 Admin
- TOTP；
- Backup Codes；
- Session list；
- Revoke session；
- Login history；
- 高权限账户可配置强制 MFA。

### 14.7 File
```text
Upload
→ extension allowlist
→ MIME / magic
→ size
→ random storage name
→ quarantine
→ ClamAV
→ risk state
→ publish
```

默认存 Web Root 外。

### 14.8 SSRF
Risk/preview 等任何会主动访问用户 URL 的服务必须阻止：
- loopback；
- private networks；
- link-local；
- metadata endpoints；
- IPv6 private/reserved；
- DNS rebinding；
- redirect chain 到内网。

### 14.9 Rate Limit
至少覆盖：
- auth；
- OTP；
- reset；
- OAuth；
- Create link；
- QR；
- upload；
- text；
- ticket；
- API；
- Admin Login；
- Risk。

Rate key 根据业务组合：
- IP；
- account；
- email；
- workspace；
- API key；
- session/device。

### 14.10 Logging
禁止写入：
- password；
- session token；
- access token；
- secrets；
- DB password；
- OAuth secret；
- payment secret。

---

## 15. Cache 策略

### Immutable assets
hash 文件：
`public, max-age=31536000, immutable`

### Marketing HTML
短缓存，可 revalidate。

### Auth
`no-store`

### Workspace/Admin HTML
`no-store` 或极短 private cache。

### Sensitive API
`private, no-store`

### Payment / Security
`no-store`

---

## 16. Accessibility

目标：

**WCAG 2.2 AA**

硬要求：
- 正文 4.5:1；
- 大字 3:1；
- 键盘操作；
- focus-visible；
- icon button aria-label；
- tooltip；
- visible form label；
- 颜色不能作为唯一状态；
- 200% zoom；
- reduced motion；
- 最小可交互目标不低于 24×24，主要触控按钮建议 ≥40px。

---

## 17. 性能预算

### Website
- Initial JS：目标 ≤150KB gzip；
- 不为 Hero 加载整个 Workspace bundle；
- hero animation 只加载 Motion 必要能力；
- 图片 AVIF/WebP；
- fonts self-host subset；
- LCP ≤2.5s；
- INP ≤200ms；
- CLS ≤0.1。

### Workspace/Admin
- route-level split；
- chart library lazy；
- admin 不进入 workspace bundle；
- marketing 不进入 app bundle；
- large table virtualization 只在数据量确实需要时开启。

---

## 18. Capability Matrix 格式

建立：

`docs/v5/CAPABILITY-MATRIX.md`

每一项记录：

| Capability | Backend | API | UI | RBAC | States | Browser | Security | Release |
|---|---|---|---|---|---|---|---|---|

只有全部通过才 DONE。

---

## 19. 开发节点

### P00 — V4 Inventory
登记：
- API；
- DB；
- Redis；
- 8 Services；
- migrations；
- features；
- permissions；
- installer；
- tests。

### P01 — V5 Engineering Foundation
- pnpm workspace；
- apps/packages；
- build；
- Router；
- Query；
- API client；
- CI；
- code splitting。

### P02 — Brand Foundation
冻结：
- palette；
- typography；
- logo usage；
- icon system；
- motion；
- imagery；
- light/dark。

### P03 — Design System
完成全部 primitives / patterns。

### P04 — Shell
- Website；
- Auth；
- Docs；
- Workspace；
- Admin。

三 viewport Gate。

### P05 — Links Vertical Slice
必须一次做到：
- List；
- Search；
- Filters；
- Create；
- Detail；
- Edit；
- Analytics；
- Routing；
- A/B；
- Access；
- QR；
- History；
- Delete；
- Bulk；
- Loading/Empty/Error；
- RBAC；
- mobile。

**这是整个 V5 第一次产品视觉总验收点。**

### P06 — Domains
### P07 — Analytics
### P08 — QR
### P09 — Files
### P10 — Text
### P11 — Bio
### P12 — Workspace / Members / Organization
### P13 — Billing / Payments / FX
### P14 — Tickets / Mail
### P15 — Auth / OAuth / Account
### P16 — Trust & Safety
### P17 — Admin
### P18 — Docs
### P19 — Website Final
官网此时使用真正完成的产品 UI，而不是预先画假的 Dashboard。
### P20 — Whole Product Gate
### P21 — Native Package
### P22 — Fresh Install Candidate

---

## 20. 验收 Gate

### G0 Scope Gate
- P0 功能无减少；
- route map 完整；
- capability matrix 完整。

### G1 Architecture Gate
- 无循环依赖；
- 独立 build；
- bundle 边界正确；
- API client 统一。

### G2 Design System Gate
- 无业务页面私自创造颜色；
- Light/Dark；
- Focus；
- Keyboard；
- Density；
- Responsive。

### G3 Functional Gate
真实：
- API；
- MySQL；
- Redis；
- Worker；
- Mail；
- Storage。

禁止 mock 冒充完成。

### G4 Browser Gate
固定：
- 1440×900；
- 1024×768；
- 390×844。

硬失败：
- horizontal overflow；
- pageerror；
- console error；
- nav reload；
- clipped text；
- broken focus；
- sidebar/header layout jump；
- dialog/sheet 改变主布局宽度。

### G5 Accessibility Gate
- axe；
- keyboard；
- labels；
- focus；
- contrast；
- zoom；
- reduced motion。

### G6 Security Gate
- Auth；
- RBAC；
- tenant；
- CSRF；
- session；
- CSP；
- Turnstile；
- rate limit；
- SSRF；
- upload；
- secrets；
- audit。

### G7 SEO Gate
公开页面检查：
- HTML body；
- title；
- description；
- canonical；
- H1；
- hreflang；
- OG；
- structured data；
- sitemap；
- 404；
- redirect；
- internal links。

同时检查：
- app/admin/auth/install noindex；
- UGC noindex；
- sitemap 无敏感 URL。

### G8 Visual Gate
- screenshot diff；
- spacing；
- alignment；
- responsive；
- dark mode；
- image quality；
- no placeholder icon；
- no random illustration；
- motion quality。

### G9 Performance Gate
- bundle budget；
- image optimization；
- CWV lab；
- cache headers；
- no huge fonts；
- no long main-thread tasks。

### G10 Full-stack P0
完整实际链路：
Register → verify → login → create link → redirect → analytics → QR → file → text → bio → domain → ticket → billing → admin。

### G11 Package Gate
- binaries；
- migrations；
- frontend；
- installer；
- checksum；
- SBOM；
- version manifest。

### G12 Fresh Install
真实 aaPanel / BT：
- Nginx；
- PHP 8.3；
- MySQL 8.x；
- Redis；
- systemd；
- ClamAV。

### G13 Production Validation
- 8 services restart；
- Nginx restart；
- Redis/MySQL reconnect；
- ClamAV EICAR；
- QR 真渲染；
- File 真上传/下载；
- PDF 真渲染；
- Mail；
- OAuth；
- Turnstile production；
- Real payment channel。

---

## 21. Release Definition of Done

只有以下全部成立才允许发布 V5：

```text
P0 功能完整
+ Design System 完整
+ Website 精美且有生命感
+ Docs 完整
+ Workspace 成熟
+ Admin 成熟
+ Desktop / Tablet / Mobile
+ Accessibility
+ SEO
+ UGC index policy
+ Security
+ Performance
+ Full-stack
+ Package
+ Fresh Install
+ Production Validation
= GoJet V5
```

---

## 22. 外部规范基线

实施时以下官方规范视为参考基线：

- Google Search Central：JavaScript SEO、canonical、sitemap、robots、structured data；
- Web.dev：Core Web Vitals；
- OWASP Cheat Sheet Series：Session、CSRF、CSP、SSRF、File Upload、Logging、MFA；
- W3C WCAG 2.2；
- Motion 官方 React 文档；
- Lucide 官方设计与包规范；
- shadcn/ui 官方文档；
- Astro Starlight / Pagefind 官方文档。
