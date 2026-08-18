import { useMemo, useState } from "react";
import { applyThemePreference, type ThemePreference } from "@gojet/tokens";
import { AlertCircle, BarChart3, Globe2, Link2, Plus, Search, Settings, Trash2, Users } from "@gojet/icons";
import { Alert, Badge, Breadcrumb, Button, Checkbox, DataRegion, Dialog, EmptyState, ErrorState, Field, FormSection, IconButton, Input, Page, PageHeader, PageSection, Select, SettingsSection, Skeleton, Spinner, Switch, Table, Tabs, Textarea, Tooltip } from "@gojet/ui";
import { AppHeader, Avatar, BulkActionBar, ChartFrame, Combobox, Command, DatePicker, DateTime, FilterBar, InlineMessage, Metric, OtpInput, Pagination, Progress, RadioGroup, Sheet, Sidebar, SidebarItem, Slider, Sparkline, SplitPane, Surface, WorkspaceSwitcher } from "@gojet/ui/patterns";
import { AlertDialog, ContextMenu, DropdownMenu, HoverCard, MobileDrawer, Popover, SelectMenu, UserMenu } from "@gojet/ui/overlays";
import { DataTable, type ColumnDef } from "@gojet/ui/data";
import { notify } from "@gojet/ui/feedback";

type DemoLink = { id: string; short: string; destination: string; status: "正常" | "待检查"; clicks: number };

const demoLinks: DemoLink[] = [
  { id: "1", short: "gojet.example/demo", destination: "https://example.com/product", status: "正常", clicks: 1284 },
  { id: "2", short: "gojet.example/campaign", destination: "https://example.com/summer", status: "待检查", clicks: 327 },
  { id: "3", short: "gojet.example/docs", destination: "https://example.com/docs", status: "正常", clicks: 812 },
];

export default function DevUi() {
  const [radio, setRadio] = useState("302");
  const [weight, setWeight] = useState(50);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [otp, setOtp] = useState("");
  const [workspace, setWorkspace] = useState("personal");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [locale, setLocale] = useState<"zh-CN" | "en">("zh-CN");
  const columns = useMemo<ColumnDef<DemoLink, unknown>[]>(() => [
    { accessorKey: "short", header: locale === "zh-CN" ? "短链接" : "Short link", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    { accessorKey: "destination", header: locale === "zh-CN" ? "目标地址" : "Destination", cell: ({ getValue }) => <span className="dev-ui-truncate">{String(getValue())}</span> },
    { accessorKey: "status", header: locale === "zh-CN" ? "状态" : "Status", cell: ({ getValue }) => <Badge tone={getValue() === "正常" ? "success" : "warning"}>{String(getValue())}</Badge> },
    { accessorKey: "clicks", header: locale === "zh-CN" ? "点击" : "Clicks", cell: ({ getValue }) => Number(getValue()).toLocaleString() },
  ], [locale]);
  const menuActions = [
    { id: "open", label: "打开详情" },
    { id: "duplicate", label: "复制链接" },
    { id: "delete", label: "删除", destructive: true, separatorBefore: true },
  ];
  const setThemePreference = (value: ThemePreference) => { setTheme(value); applyThemePreference(value); };

  return (
    <Page className="dev-ui gj-ui-root" lang={locale}>
      <Breadcrumb items={[{ label: "GoJet V5" }, { label: "Design System" }, { label: "P03" }]} />
      <PageHeader title={locale === "zh-CN" ? "GoJet 设计系统" : "GoJet Design System"} description={locale === "zh-CN" ? "P03 内部验证面。验证 primitives、patterns、状态与主题，不代表 Website 或业务页面完成。" : "P03 internal verification surface for primitives, patterns, states and themes. It does not represent finished product pages."} actions={<><Button variant="outline">{locale === "zh-CN" ? "次要操作" : "Secondary"}</Button><Button><Plus size={16} strokeWidth={1.75} />{locale === "zh-CN" ? "创建" : "Create"}</Button></>} />

      <PageSection title="Foundation Modes / 基础模式">
        <div className="dev-ui-row" aria-label="主题验证"><strong>Theme</strong>{(["light", "dark", "system"] as const).map((item) => <Button key={item} size="sm" variant={theme === item ? "primary" : "outline"} onClick={() => setThemePreference(item)}>{item}</Button>)}</div>
        <div className="dev-ui-row" aria-label="语言验证"><strong>Locale</strong><Button size="sm" variant={locale === "zh-CN" ? "primary" : "outline"} onClick={() => setLocale("zh-CN")}>简体中文</Button><Button size="sm" variant={locale === "en" ? "primary" : "outline"} onClick={() => setLocale("en")}>English</Button></div>
      </PageSection>

      <PageSection title="Buttons / Actions">
        <div className="dev-ui-row"><Button>主要操作</Button><Button variant="secondary">次要</Button><Button variant="outline">描边</Button><Button variant="ghost">Ghost</Button><Button variant="link">Link</Button><Button variant="destructive"><Trash2 size={16} strokeWidth={1.75} />删除</Button><Button loading>处理中</Button><Button disabled>不可用</Button><Tooltip label="搜索"><IconButton label="搜索"><Search size={16} strokeWidth={1.75} /></IconButton></Tooltip></div>
      </PageSection>

      <PageSection title="Forms / Controls">
        <div className="dev-ui-grid">
          <Field label="链接标题" htmlFor="demo-title" help="清晰、可读的资源名称。"><Input id="demo-title" placeholder="例如：夏季活动主页" /></Field>
          <Field label="官方域名" htmlFor="demo-domain"><Select id="demo-domain" defaultValue="gojet"><option value="gojet">gojet.example</option><option value="brand">brand.example</option></Select></Field>
          <Field label="错误状态" htmlFor="demo-error" error="请输入有效内容。"><Input id="demo-error" aria-invalid="true" defaultValue="Invalid" /></Field>
          <Field label="说明" htmlFor="demo-notes"><Textarea id="demo-notes" placeholder="补充说明" /></Field>
          <Combobox id="demo-combo" label="标签" options={["Campaign", "Product", "Docs"]} />
          <OtpInput id="demo-otp" value={otp} onChange={setOtp} />
          <DatePicker id="demo-date" label="到期日期" />
          <DateTime id="demo-datetime" label="精确到期时间" />
        </div>
        <div className="dev-ui-grid"><RadioGroup name="redirect" label="跳转类型" value={radio} onChange={setRadio} options={[{ value: "301", label: "301", description: "永久跳转" }, { value: "302", label: "302", description: "临时跳转" }]} /><Slider label="A/B 权重" value={weight} onChange={setWeight} /></div>
        <div className="dev-ui-row"><Checkbox defaultChecked label="启用访问分析" /><Switch defaultChecked label="链接处于启用状态" /></div>
      </PageSection>

      <PageSection title="Status / Feedback / Toast">
        <div className="dev-ui-row"><Badge>默认</Badge><Badge tone="success">正常</Badge><Badge tone="warning">待处理</Badge><Badge tone="danger">已阻止</Badge><Badge tone="info">信息</Badge></div>
        <div className="dev-ui-stack"><Alert tone="info" title="配置已保存">新的配置会应用到后续请求。</Alert><Alert tone="warning" title="需要验证">自定义域名 DNS 尚未完成验证。</Alert><Alert tone="danger" title="操作被阻止">当前角色没有执行此操作的权限。</Alert><InlineMessage tone="success">变更已写入审计记录。</InlineMessage><Progress label="月度链接用量" value={68} /></div>
        <div className="dev-ui-row"><Button size="sm" variant="outline" onClick={() => notify({ title: "保存成功", description: "配置已写入。", tone: "success" })}>Success Toast</Button><Button size="sm" variant="outline" onClick={() => notify({ title: "需要检查", description: "DNS 尚未验证。", tone: "warning" })}>Warning Toast</Button><Button size="sm" variant="outline" onClick={() => notify({ title: "操作失败", description: "当前请求未完成。", tone: "danger" })}>Danger Toast</Button><Spinner /><Skeleton style={{ width: 180 }} /><Skeleton style={{ width: 96 }} /></div>
      </PageSection>

      <DataRegion title="DataTable / ColumnManager" description="TanStack Table：排序、选行、列显隐、密度和资源状态。" actions={<Badge tone="info">P03</Badge>}>
        <DataTable data={demoLinks} columns={columns} label="链接数据表" selectable getRowId={(row) => row.id} toolbar={() => <span className="dev-ui-meta">3 records</span>} />
      </DataRegion>

      <PageSection title="Data / Tabs / Filtering">
        <FilterBar search={search} onSearch={setSearch} actions={<Button variant="outline">导出</Button>}><Badge tone="info">状态：全部</Badge></FilterBar>
        <BulkActionBar selected={2}><Button size="sm" variant="outline">暂停</Button><Button size="sm" variant="destructive">删除</Button></BulkActionBar>
        <div className="dev-ui-metrics"><Metric icon={Link2} label="短链接" value="12,840" change="近 30 天 +8.4%" /><Metric icon={Users} label="成员" value="18" change="2 个待接受邀请" /><ChartFrame title="访问趋势" description="内部演示数据"><Sparkline values={[8, 12, 9, 17, 15, 23, 28, 24, 31]} /></ChartFrame></div>
        <Tabs defaultValue="overview" items={[{ value: "overview", label: "概览", content: <Table label="链接示例"><thead><tr><th>链接</th><th>状态</th><th>点击</th></tr></thead><tbody><tr><td>gojet.example/demo</td><td><Badge tone="success">正常</Badge></td><td>1,284</td></tr><tr><td>gojet.example/campaign</td><td><Badge tone="warning">待检查</Badge></td><td>327</td></tr></tbody></Table> }, { value: "analytics", label: "分析", content: <EmptyState icon={<BarChart3 size={30} strokeWidth={1.75} />} title="暂无分析数据" description="真实事件写入后，这里才会出现统计结果。" /> }]} />
        <Pagination page={page} pages={12} onChange={setPage} />
      </PageSection>

      <PageSection title="Overlay / Destructive / Command">
        <div className="dev-ui-row"><Dialog triggerLabel="打开对话框" title="更新链接设置" description="对话框不得改变底层页面布局宽度。"><p>这是 Base UI Dialog 封装后的 GoJet 表面。</p></Dialog><AlertDialog triggerLabel="Alert Dialog" title="永久删除链接？" description="删除后无法恢复。" confirmLabel="确认删除" /><Sheet triggerLabel="打开 Sheet" title="筛选条件" description="桌面端辅助面板。"><Command items={[{ id: "links", label: "前往链接" }, { id: "domains", label: "前往域名" }, { id: "settings", label: "前往设置" }]} /></Sheet><MobileDrawer title="移动端导航" description="支持滑动关闭。"><Command items={[{ id: "links", label: "链接" }, { id: "domains", label: "域名" }, { id: "analytics", label: "分析" }]} /></MobileDrawer></div>
        <div className="dev-ui-row"><DropdownMenu actions={menuActions} /><SelectMenu label="批量操作" actions={menuActions} /><UserMenu name="Ethan" actions={[{ id: "profile", label: "个人资料" }, { id: "logout", label: "退出登录", separatorBefore: true }]} /><Popover trigger="打开 Popover" title="链接摘要" description="轻量上下文信息。"><p>短码：summer-2026</p></Popover><HoverCard href="/app/links/demo" trigger={<span>预览短链接</span>}><strong>gojet.example/demo</strong><p>悬停或聚焦时显示预览。</p></HoverCard></div>
        <ContextMenu actions={menuActions}><div className="dev-ui-context-target">右键 / 长按此区域测试 Context Menu</div></ContextMenu>
      </PageSection>

      <PageSection title="Shell Building Blocks">
        <Surface className="dev-ui-shell"><Sidebar brand={<strong>GoJet</strong>} footer={<Avatar name="Ethan H" />}><WorkspaceSwitcher value={workspace} onChange={setWorkspace} options={[{ value: "personal", label: "个人工作区" }, { value: "team", label: "GoJet Team" }]} /><SidebarItem icon={Link2} label="链接" active /><SidebarItem icon={Globe2} label="域名" /><SidebarItem icon={Settings} label="设置" /></Sidebar><div className="dev-ui-shell-main"><AppHeader context={<strong>链接</strong>} actions={<Avatar name="Ethan H" />} /><SplitPane primary={<div className="dev-ui-shell-placeholder">主内容区域</div>} secondary={<div className="dev-ui-shell-placeholder">辅助区域</div>} /></div></Surface>
      </PageSection>

      <PageSection title="Layout Regions">
        <div className="dev-ui-grid"><SettingsSection title="工作区设置" description="用于设置类页面的稳定分组。"><Switch defaultChecked label="启用通知" /></SettingsSection><FormSection title="访问控制" description="用于一组语义相关的表单控件。"><Field label="访问密码" htmlFor="demo-password"><Input id="demo-password" type="password" /></Field></FormSection></div>
      </PageSection>

      <PageSection title="Resource States">
        <div className="dev-ui-state-grid"><EmptyState icon={<AlertCircle size={30} strokeWidth={1.75} />} title="暂无资源" description="创建第一个资源后会显示在这里。" action={<Button>开始创建</Button>} /><ErrorState title="加载失败" description="服务暂时无法返回数据。" action={<Button variant="outline">重试</Button>} /></div>
      </PageSection>
    </Page>
  );
}
