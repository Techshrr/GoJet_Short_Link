import { AlertCircle, BarChart3, Plus, Search, Trash2 } from "@gojet/icons";
import { Alert, Badge, Breadcrumb, Button, Checkbox, Dialog, EmptyState, ErrorState, Field, IconButton, Input, Page, PageHeader, PageSection, Select, Skeleton, Spinner, Switch, Table, Tabs, Textarea, Tooltip } from "@gojet/ui";

export default function DevUi() {
  return (
    <Page className="dev-ui gj-ui-root">
      <Breadcrumb items={[{ label: "GoJet V5" }, { label: "Design System" }, { label: "P03" }]} />
      <PageHeader title="GoJet Design System" description="P03 内部验证面。这里验证 primitives/states，不代表 Website 或业务页面完成。" actions={<><Button variant="outline">次要操作</Button><Button><Plus size={16} strokeWidth={1.75} />创建</Button></>} />

      <PageSection title="Buttons / Actions">
        <div className="dev-ui-row"><Button>主要操作</Button><Button variant="secondary">次要</Button><Button variant="outline">描边</Button><Button variant="ghost">Ghost</Button><Button variant="destructive"><Trash2 size={16} strokeWidth={1.75} />删除</Button><Button loading>处理中</Button><Button disabled>不可用</Button><Tooltip label="搜索"><IconButton label="搜索"><Search size={16} strokeWidth={1.75} /></IconButton></Tooltip></div>
      </PageSection>

      <PageSection title="Forms">
        <div className="dev-ui-grid">
          <Field label="链接标题" htmlFor="demo-title" help="清晰、可读的资源名称。"><Input id="demo-title" placeholder="例如：夏季活动主页" /></Field>
          <Field label="官方域名" htmlFor="demo-domain"><Select id="demo-domain" defaultValue="gojet"><option value="gojet">gojet.example</option><option value="brand">brand.example</option></Select></Field>
          <Field label="错误状态" htmlFor="demo-error" error="请输入有效内容。"><Input id="demo-error" aria-invalid="true" defaultValue="Invalid" /></Field>
          <Field label="说明" htmlFor="demo-notes"><Textarea id="demo-notes" placeholder="补充说明" /></Field>
        </div>
        <div className="dev-ui-row"><Checkbox defaultChecked label="启用访问分析" /><Switch defaultChecked label="链接处于启用状态" /></div>
      </PageSection>

      <PageSection title="Status / Feedback">
        <div className="dev-ui-row"><Badge>默认</Badge><Badge tone="success">正常</Badge><Badge tone="warning">待处理</Badge><Badge tone="danger">已阻止</Badge><Badge tone="info">信息</Badge></div>
        <div className="dev-ui-stack"><Alert tone="info" title="配置已保存">新的配置会应用到后续请求。</Alert><Alert tone="warning" title="需要验证">自定义域名 DNS 尚未完成验证。</Alert><Alert tone="danger" title="操作被阻止">当前角色没有执行此操作的权限。</Alert></div>
        <div className="dev-ui-row"><Spinner /><Skeleton style={{ width: 180 }} /><Skeleton style={{ width: 96 }} /></div>
      </PageSection>

      <PageSection title="Data / Tabs">
        <Tabs defaultValue="overview" items={[{ value: "overview", label: "概览", content: <Table label="链接示例"><thead><tr><th>链接</th><th>状态</th><th>点击</th></tr></thead><tbody><tr><td>gojet.example/demo</td><td><Badge tone="success">正常</Badge></td><td>1,284</td></tr><tr><td>gojet.example/campaign</td><td><Badge tone="warning">待检查</Badge></td><td>327</td></tr></tbody></Table> }, { value: "analytics", label: "分析", content: <EmptyState icon={<BarChart3 size={30} strokeWidth={1.75} />} title="暂无分析数据" description="真实事件写入后，这里才会出现统计结果。" /> }]} />
      </PageSection>

      <PageSection title="Overlay / Destructive">
        <div className="dev-ui-row"><Dialog triggerLabel="打开对话框" title="更新链接设置" description="对话框不得改变底层页面布局宽度。"><p>这是 Base UI Dialog 封装后的 GoJet 表面。</p></Dialog><Dialog destructive triggerLabel="危险操作" title="删除资源" description="此操作不可撤销。" confirmLabel="确认删除"><p>删除前必须明确对象和后果。</p></Dialog></div>
      </PageSection>

      <PageSection title="Resource States">
        <div className="dev-ui-state-grid"><EmptyState icon={<AlertCircle size={30} strokeWidth={1.75} />} title="暂无资源" description="创建第一个资源后会显示在这里。" action={<Button>开始创建</Button>} /><ErrorState title="加载失败" description="服务暂时无法返回数据。" action={<Button variant="outline">重试</Button>} /></div>
      </PageSection>
    </Page>
  );
}
