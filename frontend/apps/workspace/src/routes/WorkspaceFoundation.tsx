import { Page, PageHeader } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";

const taskClass = "workspace-overview-task";

export default function WorkspaceFoundation() {
  const { text } = useLocale();
  const tasks = [
    {
      href: "/app/links?create=1",
      title: text("Create a short link", "创建短链接"),
      body: text(
        "Enter the destination, choose the public domain and short path, then add expiration, access restrictions, campaign information or routing only when the link needs them.",
        "填写目标地址，选择公开域名和短路径；只有在确实需要时，再设置有效期、访问限制、推广活动或条件跳转。"
      )
    },
    {
      href: "/app/domains",
      title: text("Connect a domain", "绑定域名"),
      body: text(
        "Add a hostname you control, follow the DNS instructions shown by GoJet, and wait for verification and HTTPS readiness before assigning it to public content.",
        "添加你控制的主机名，按照 GoJet 显示的说明配置 DNS，并等待域名验证和 HTTPS 状态可用后，再把它分配给公开内容。"
      )
    },
    {
      href: "/app/analytics",
      title: text("Review visits", "查看访问数据"),
      body: text(
        "Filter recorded visits by time range, content, domain, campaign, country or region, device and referrer so you can see which published items are actually being used.",
        "按时间范围、内容、域名、推广活动、国家或地区、设备和来源筛选已记录访问，了解哪些已发布内容正在被实际使用。"
      )
    },
    {
      href: "/app/members",
      title: text("Manage members", "管理成员"),
      body: text(
        "Review who belongs to this workspace, invite the people who need access, and assign only the permissions required for their work.",
        "查看当前工作区成员，邀请需要参与的人，并只授予完成其工作所需的权限。"
      )
    }
  ];

  return <Page className="workspace-overview-page">
    <PageHeader
      title={text("Workspace overview", "工作区概览")}
      description={text(
        "Start the most common workspace tasks here. Create and update public content, connect domains, review recorded visits, manage members, and use the navigation to open the detailed settings for each area.",
        "在这里开始最常用的工作区操作。可以创建和更新公开内容、绑定域名、查看真实访问记录、管理成员，并通过左侧导航进入每项功能的详细设置。"
      )}
    />
    <section className="workspace-overview-tasks" aria-label={text("Common workspace tasks", "常用工作区操作")}>
      {tasks.map((task) => <a className={taskClass} href={task.href} key={task.href}><strong>{task.title}</strong><p>{task.body}</p><span>{text("Open", "进入")}</span></a>)}
    </section>
  </Page>;
}
