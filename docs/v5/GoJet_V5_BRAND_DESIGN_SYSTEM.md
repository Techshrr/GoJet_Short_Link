# GoJet V5 Brand & Design System Specification
**文档编号：GJ-V5-002**  
**状态：FROZEN VISUAL CONTRACT**  
**目标：让 Website / Auth / Docs / Workspace / Admin 看起来是一个品牌、五种任务密度，而不是五套主题。**

---

# 1. 品牌核心

GoJet 的产品人格固定为：

**Precise · Fast · Controlled · Modern**

不得偏向：
- 游戏化；
- Web3 霓虹风；
- 传统 ERP；
- AdminLTE；
- 过度玻璃拟态；
- 大面积紫色渐变；
- 卡片墙；
- 纯黑极客站；
- 极简到干瘪。

视觉必须表现：
- 速度；
- 路径；
- 分流；
- 反馈；
- 精确控制；
- 清晰数据；
- 轻量运动。

---

# 2. 品牌色

## 2.1 Core

```css
--brand-ink: #0B1220;
--brand-blue: #2563EB;
--brand-blue-strong: #1D4ED8;
--brand-cyan: #06B6D4;
--brand-sky: #38BDF8;
```

## 2.2 Light Surface

```css
--canvas: #F7F9FC;
--surface: #FFFFFF;
--surface-muted: #F1F5F9;
--surface-elevated: #FFFFFF;

--foreground: #0F172A;
--foreground-secondary: #334155;
--foreground-muted: #64748B;

--border: #E2E8F0;
--border-strong: #CBD5E1;
```

## 2.3 Dark Surface

```css
--canvas-dark: #070B14;
--surface-dark: #0D1422;
--surface-muted-dark: #121B2C;
--surface-elevated-dark: #111A2A;

--foreground-dark: #F8FAFC;
--foreground-secondary-dark: #CBD5E1;
--foreground-muted-dark: #94A3B8;

--border-dark: #1E293B;
--border-strong-dark: #334155;
```

## 2.4 Semantic

```css
--success: #16A34A;
--success-subtle: #F0FDF4;

--warning: #D97706;
--warning-subtle: #FFFBEB;

--danger: #DC2626;
--danger-subtle: #FEF2F2;

--info: #0EA5E9;
--info-subtle: #F0F9FF;
```

品牌色不能被复用为 Warning/Danger。

---

# 3. 品牌渐变

允许使用的品牌渐变只有以下三种语义。

## 3.1 Hero Ambient
```css
linear-gradient(135deg, #2563EB 0%, #06B6D4 55%, #38BDF8 100%)
```
实际使用时透明度降低，不作为整块背景填满页面。

## 3.2 Brand Border Glow
```css
linear-gradient(90deg, rgba(37,99,235,.45), rgba(6,182,212,.35))
```

## 3.3 Data Highlight
蓝 → 青，仅用于：
- analytics trend；
- routing path；
- active progress。

禁止：
- 彩虹渐变；
- 红橙紫混入主品牌渐变；
- gradient text 作为所有 H1 的默认样式。

---

# 4. Logo 使用

最终 Logo 需要输出：

```text
logo-full-light.svg
logo-full-dark.svg
logo-mark.svg
favicon.svg
favicon.ico
apple-touch-icon.png
og-brand.png
```

Safe Area：
- Mark 周围至少 0.5× mark 高度；
- Header Logo 高度 28–32px；
- Workspace Sidebar Logo 28px；
- Docs Header 26–28px。

禁止：
- 拉伸；
- 改色；
- 加发光；
- 加描边；
- 在复杂照片上直接无底使用导致低对比。

---

# 5. Brand Motif：Jet Path

GoJet 独有视觉元素：

**Jet Path = 路径 + 节点 + 分流 + 数据反馈**

基础结构：

```text
○───────────────●
      ╲
       ─────────○
```

表现语义：
- ○ 未激活节点；
- ● Active / hit；
- Path 表示跳转；
- Split 表示 routing / A/B；
- Pulse 表示访问事件。

适用：
- Hero；
- Product section transition；
- Routing page；
- A/B；
- Analytics；
- empty state；
- loading illustration。

禁止把 Jet Path 用在：
- Input border；
- 普通 button；
- table cell 装饰；
- 每张 card。

它是品牌点缀，不是背景噪音。

---

# 6. Typography

## 6.1 Font Stack

英文、数字：
```css
InterVariable, Inter, ui-sans-serif, system-ui
```

中文：
```css
"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui
```

原则：
- Inter self-host；
- woff2；
- latin subset；
- 中文优先系统字体，避免全量 CJK Web Font。

## 6.2 Type Scale

### Marketing
| Token | Desktop | Mobile | Weight | Line |
|---|---:|---:|---:|---:|
| display-xl | 64 | 44 | 650 | 1.05 |
| display-lg | 52 | 38 | 650 | 1.08 |
| h1 | 44 | 34 | 650 | 1.12 |
| h2 | 34 | 28 | 620 | 1.18 |
| h3 | 24 | 22 | 600 | 1.25 |
| body-lg | 18 | 17 | 400 | 1.65 |
| body | 16 | 16 | 400 | 1.65 |
| meta | 14 | 14 | 450 | 1.5 |

### Product
| Token | Size |
|---|---:|
| page-title | 24 |
| section-title | 16–18 |
| body | 14 |
| compact | 13 |
| meta | 12 |
| table | 13–14 |

Admin 不使用 40px 巨大 page title。

---

# 7. Spacing

基础 grid：4px。

Tokens：
```text
1=4
2=8
3=12
4=16
5=20
6=24
8=32
10=40
12=48
16=64
20=80
24=96
```

原则：
- 组件内部使用 4/8/12/16；
- Page section 使用 24/32；
- Marketing section 纵向 80–128；
- Mobile section 56–80。

---

# 8. Radius

```text
xs    4px
sm    6px
md    8px
lg   12px
xl   16px
2xl  20px（仅 Marketing 大容器 / Hero）
```

默认：
- Button 8；
- Input 8；
- Table container 10–12；
- Modal 14；
- Sheet 0/16（按边缘）；
- Marketing visual 16–20。

禁止所有东西 20–24px 大圆角。

---

# 9. Shadow / Elevation

## E0
无 shadow，靠 border。

## E1
```css
0 1px 2px rgba(15,23,42,.05)
```

## E2
```css
0 8px 24px rgba(15,23,42,.08)
```

## E3
```css
0 20px 60px rgba(15,23,42,.12)
```

使用：
- product card：E0/E1；
- dropdown/popover：E2；
- modal：E3；
- sidebar：不用重 shadow。

---

# 10. Border

默认：
```css
1px solid var(--border)
```

Focus 不依赖 border-color 单独表达，应同时使用 ring。

Active navigation：
- background subtle；
- foreground；
- 2px active indicator 或明确 icon/text 状态。

---

# 11. Icon System

## 11.1 Lucide 是唯一默认功能图库

尺寸：
- inline: 16；
- button: 16；
- sidebar: 18；
- page action: 18；
- marketing feature: 20–24；
- empty: 28–32。

Stroke：
- 默认 1.75；
- 小于 16 时可 2。

禁止 Emoji 充当功能图标。

## 11.2 Brand Icons
优先官方品牌资产，其次 Simple Icons。

所有品牌资产在：
```text
packages/icons/brands/
```

并建立：
```text
BRAND-ASSET-LICENSES.md
```

---

# 12. Motion System

Motion 不是“哪里都动”，而是建立层级。

## Level 0 — Static
用于：
- long-form docs；
- table rows；
- settings forms。

## Level 1 — Feedback
120–180ms：
- hover；
- active；
- checkbox；
- menu；
- tooltip；
- button press。

## Level 2 — Transition
180–320ms：
- dialog；
- sheet；
- dropdown；
- tabs indicator；
- accordion。

## Level 3 — Product Motion
350–650ms：
- page section reveal；
- metric count；
- chart enter；
- QR build；
- link created success。

## Level 4 — Brand Ambient
5–10s：
- breathing；
- floating product stage；
- moving Jet Path；
- subtle gradient drift。

只允许 Website 以及极少量 Workspace empty/onboarding 使用 Level 4。

---

# 13. Breathing Effect 规范

Hero 背景建立两个 radial halo：

```text
Halo A: Brand Blue
Halo B: Jet Cyan
```

动画：

```text
duration 8s / 10s
ease-in-out
alternate
scale 0.98 → 1.035
translate 0 → 6px
opacity .48 → .68
```

两个 Halo phase 错开约 2.5 秒。

结果应像“界面在呼吸”，而不是明显看到一个球在放大缩小。

---

# 14. Hero Product Stage

首页 Hero 右侧/下方必须是实际产品视觉，不允许只有插画。

Desktop：
- stage 640–720px 宽；
- 360–460px 高；
- 主 Workspace frame；
- 浮层 2–3 个：
  - QR；
  - Analytics；
  - Routing event。

运动：
- 主 frame 上下 ±8px；
- Analytics card delay 1.2s；
- QR card delay 2.1s；
- pointer parallax 最大 5px。

Mobile：
- 移除 parallax；
- stage 100%；
- 只保留主 frame + 1 个浮层；
- 不横向溢出。

---

# 15. 图片规范

## 15.1 真实 UI
最终网站所有产品截图必须来自当前 exact HEAD。

截图 viewport：
- 1440×900；
- 1280×800；
- mobile 390×844。

展示前去除：
- 测试账号隐私；
- secret；
- internal ID；
- debug UI。

## 15.2 Photography
Photography 风格：
- 自然光；
- 真实办公/创作；
- 不使用握手商务照；
- 不使用“人在指着空白屏幕”；
- 不使用夸张 AI 面孔。

图像要经过统一：
- crop；
- contrast；
- color temperature；
- AVIF/WebP；
- alt。

## 15.3 不允许
- Hotlink；
- 低清 JPG；
- 水印；
- 版权来源不明；
- 随机 AI 图堆满官网；
- 纯装饰图片却写 SEO keyword alt。

---

# 16. Component Foundation

以下必须先存在于 `packages/ui`，业务页面才能开发。

## Controls
- Button；
- IconButton；
- Input；
- Textarea；
- Select；
- Combobox；
- Checkbox；
- Radio；
- Switch；
- Slider；
- DatePicker；
- DateTime；
- OTP Input。

## Overlay
- Dialog；
- AlertDialog；
- Sheet；
- Popover；
- DropdownMenu；
- ContextMenu；
- Tooltip；
- Command；
- HoverCard。

## Navigation
- Tabs；
- Breadcrumb；
- Pagination；
- Sidebar primitives；
- MobileDrawer；
- AppHeader；
- WorkspaceSwitcher；
- UserMenu。

## Data
- Badge；
- StatusBadge；
- Avatar；
- Table；
- DataTable；
- FilterBar；
- ColumnManager；
- BulkActionBar；
- Metric；
- Sparkline；
- ChartFrame。

## Feedback
- Alert；
- Toast；
- Skeleton；
- Spinner；
- EmptyState；
- ErrorState；
- InlineMessage；
- Progress。

## Layout
- Page；
- PageHeader；
- PageTitle；
- PageActions；
- PageSection；
- DataRegion；
- SettingsSection；
- FormSection；
- SplitPane。

---

# 17. Button

Height：
- sm 32；
- md 36；
- lg 40；
- hero 44。

Variants：
- primary；
- secondary；
- outline；
- ghost；
- destructive；
- link。

规则：
- icon 16；
- gap 8；
- nowrap；
- loading 保持原宽；
- disabled 仍清晰可读；
- destructive 不使用品牌蓝。

---

# 18. Input

Height：
- product 36；
- auth 40；
- marketing interactive hero 44–48。

规则：
- label 可见；
- placeholder 不是 label；
- error 贴近 field；
- help text 最大一行/两行；
- focus ring 2px；
- success 不自动把整个 input 变绿。

---

# 19. DataTable

Desktop row：
- compact 40；
- default 44；
- relaxed 48。

Header：
- 36–40。

支持：
- sticky header（必要时）；
- sort；
- filter；
- column；
- selection；
- bulk；
- pagination；
- empty；
- error；
- loading。

Admin 默认 compact/default。
Workspace 默认 default/relaxed。

Mobile：
- 不强行显示 12 列；
- 核心字段 + overflow actions；
- 特殊资源可自动转 list-row；
- 不使用整个页面横向滚动作为主要方案。

---

# 20. Shell Dimensions

## Website
- header 64px；
- max-width 1200/1280px；
- hero max 1280；
- section content 1120–1200；
- text line 620–760。

## Docs
- header 56；
- left nav 260；
- article 720–760；
- right ToC 220；
- gap 32。

## Workspace
- sidebar 248；
- collapsed 68；
- header 58；
- content max 1480；
- main padding desktop 28–32；
- tablet 24；
- mobile 16。

## Admin
- sidebar 256；
- collapsed 68；
- header 56；
- content max none / 1600；
- main padding 24–28；
- table density higher than workspace。

---

# 21. Responsive

Breakpoints：
```text
sm 640
md 768
lg 1024
xl 1280
2xl 1536
```

但组件以 container behavior 为主，不仅靠 viewport。

### Desktop
persistent sidebar。

### Tablet
sidebar 默认 collapsed 或 drawer，取决于页面宽度。

### Mobile
drawer；
single-column；
primary action 可 sticky bottom；
filter 使用 sheet。

---

# 22. Dark Mode

三种：
- Light；
- Dark；
- System。

Website 默认 Light，但用户切换后可记忆。

Workspace/Admin 遵从 System，用户可覆盖。

Dark 模式不是反色：
- shadow 减少；
- border 增强；
- cyan/blue brightness 限制；
- chart grid 降低对比；
- code block 单独 token。

---

# 23. Charts

只用 Recharts 包装后的 `ChartFrame`。

颜色：
1. brand-blue；
2. brand-cyan；
3. sky；
4. violet 仅数据序列；
5. neutral。

禁止随机 rainbow palette。

Tooltip、legend、empty、loading 都统一。

---

# 24. Marketing Section Patterns

建立固定 pattern，不允许每页自由发挥到互相不像。

1. Hero；
2. Product Stage；
3. Feature Rail；
4. Split Feature；
5. Workflow；
6. Metric Band；
7. Trust Band；
8. Use-case Photo；
9. Testimonial（有真实内容才用）；
10. CTA；
11. Footer。

每个页面最多混用 5–7 类，避免模板感。

---

# 25. Accessibility Visual Rules

- active 不能只变颜色；
- error 不能只变红；
- hover 不能是唯一操作入口；
- focus ring 2px；
- icon-only 有 tooltip；
- destructive 有文本；
- motion reduced；
- 文字最小 12px 仅 meta，不用于正文。

---

# 26. Design QA Checklist

每个页面必须检查：

- 是否只使用 semantic token；
- 是否使用指定 icon；
- spacing 是否在 scale；
- radius 是否在 scale；
- typography 是否在 scale；
- desktop/tablet/mobile；
- light/dark；
- hover/focus/active/disabled/loading；
- empty/error；
- long text；
- Chinese/English；
- 200% zoom；
- screenshot；
- no horizontal overflow；
- no CLS；
- no placeholder illustration。

---

# 27. 设计系统完成标准

只有当以下全部可在 Storybook-equivalent / internal `/dev/ui` 页面验证时，Foundation 才完成：

- 全部 Controls；
- Overlay；
- Navigation；
- Data；
- Feedback；
- Layout；
- Light/Dark；
- zh-CN/EN；
- Desktop/Mobile；
- reduced motion；
- keyboard；
- states。

V5 禁止“页面先写完，Design System 后补”。
