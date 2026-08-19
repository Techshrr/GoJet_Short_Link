import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createDomainsClient, type DomainDnsRecord, type DomainRecord, type LinkDomainOption, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
import { localized, useLocale } from "@gojet/ui/locale";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const domainsClient = createDomainsClient(api);

function useWorkspace() {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[])
  });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function StateBadge({ value }: { value: string }) {
  const { locale, text } = useLocale();
  const tone = value === "active" ? "success" : value === "pending" ? "warning" : "neutral";
  const label = value === "active" ? text("Active", "正常") : value === "pending" ? text("Pending", "等待处理") : value === "error" ? text("Error", "异常") : localized(value, locale);
  return <Badge tone={tone}>{label}</Badge>;
}

function DnsRecord({ record }: { record: DomainDnsRecord }) {
  const { text } = useLocale();
  return <section className="domain-dns-record" aria-label={text("DNS verification record", "DNS 验证记录")}>
    <div><span>{text("Record type", "记录类型")}</span><strong>{record.type}</strong></div>
    <div><span>{text("Host name", "主机记录")}</span><code>{record.name}</code></div>
    <div><span>{text("Record value", "记录值")}</span><code>{record.value}</code></div>
    <p>{text(
      "Add this TXT record at the DNS provider that manages your domain. After the record has propagated, return to GoJet and run verification. If you generate a new verification record, the previous value stops being valid immediately.",
      "请在当前域名使用的 DNS 服务商中添加这条 TXT 记录。等待解析生效后返回 GoJet 执行验证。如果重新生成验证记录，之前的记录值会立即失效，需要改用新记录。"
    )}</p>
  </section>;
}

function AddDomainForm({ workspaceId }: { workspaceId: number }) {
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const [hostname, setHostname] = useState("");
  const mutation = useMutation({
    mutationFn: () => domainsClient.create(workspaceId, hostname.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["domains", workspaceId] });
      setHostname("");
    }
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hostname.trim()) mutation.mutate();
  };

  return <form className="domain-create-form" onSubmit={submit}>
    {mutation.isError ? <Alert tone="danger" title={text("Could not add the domain", "无法添加域名")}>{localized(errorMessage(mutation.error), locale)}</Alert> : null}
    {mutation.data ? <><Alert tone="warning" title={text("Waiting for DNS verification", "等待 DNS 验证")}>{text("The domain has been saved. Add the TXT record shown below, wait for DNS to update, then verify the domain.", "域名已经保存。请添加下面显示的 TXT 记录，等待 DNS 生效后再执行域名验证。")}</Alert><DnsRecord record={mutation.data.dns_record} /></> : null}
    <Field label={text("Domain", "域名")} htmlFor="domain-hostname" required help={text("Enter only the hostname, such as go.example.com. Do not include https://, a path, port or IP address.", "只填写主机名，例如 go.example.com。不要包含 https://、路径、端口或 IP 地址。") }>
      <Input id="domain-hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="go.example.com" autoComplete="off" required />
    </Field>
    <div className="domain-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!hostname.trim()}>{text("Generate verification record", "生成验证记录")}</Button></div>
  </form>;
}

function DomainCard({ item, workspaceId, canManage, onRecord }: { item: DomainRecord; workspaceId: number; canManage: boolean; onRecord: (record: DomainDnsRecord | null) => void }) {
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: () => domainsClient.verify(workspaceId, item.id),
    onSuccess: async () => {
      onRecord(null);
      await queryClient.invalidateQueries({ queryKey: ["domains", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["domain-options", workspaceId] });
    }
  });
  const rotate = useMutation({
    mutationFn: () => domainsClient.rotate(workspaceId, item.id),
    onSuccess: async (result) => {
      onRecord(result.dns_record);
      await queryClient.invalidateQueries({ queryKey: ["domains", workspaceId] });
    }
  });
  const mutationError = verify.error ?? rotate.error;
  const usable = item.status === "active" && item.https_status === "active";

  return <article className="domain-card" data-domain-id={item.id}>
    <div className="domain-card-head">
      <div><span className="domain-host-label">{text("Custom domain", "自定义域名")}</span><h2>{item.hostname}</h2></div>
      <Badge tone={usable ? "success" : "warning"}>{usable ? text("Ready to use", "可以使用") : text("Not ready", "尚未就绪")}</Badge>
    </div>
    <div className="domain-state-grid">
      <div><span>{text("DNS ownership", "DNS 所有权")}</span><StateBadge value={item.status} /></div>
      <div><span>{text("HTTPS", "HTTPS")}</span><StateBadge value={item.https_status} /></div>
      <div><span>{text("Last checked", "最近检查")}</span><strong>{formatDate(item.last_checked_at)}</strong></div>
      <div><span>{text("Use for short links", "用于短链接")}</span><strong>{usable ? text("Available", "可用") : text("Unavailable", "不可用")}</strong></div>
    </div>
    {item.last_error ? <Alert tone="danger" title={text("Domain check failed", "域名检查失败")}>{localized(item.last_error, locale)}</Alert> : null}
    {mutationError ? <Alert tone="danger" title={text("Domain action failed", "域名操作失败")}>{localized(errorMessage(mutationError), locale)}</Alert> : null}
    {canManage ? <div className="domain-actions">
      <Button size="sm" type="button" loading={verify.isPending} onClick={() => verify.mutate()}>{text("Verify now", "立即验证")}</Button>
      {!usable ? <Button size="sm" variant="outline" type="button" loading={rotate.isPending} onClick={() => rotate.mutate()}>{text("Generate a new TXT record", "重新生成 TXT 记录")}</Button> : null}
    </div> : null}
  </article>;
}

function DomainOption({ item }: { item: LinkDomainOption }) {
  const { text } = useLocale();
  return <article className="domain-option-card">
    <div><span>{item.source === "official" ? text("GoJet domain", "GoJet 官方域名") : text("Verified custom domain", "已验证自定义域名")}</span><strong>{item.hostname}</strong></div>
    <div>{item.is_default ? <Badge tone="success">{text("Default", "默认")}</Badge> : <Badge tone="neutral">{text("Available", "可用")}</Badge>}</div>
  </article>;
}

export default function DomainsPage() {
  const { locale, text } = useLocale();
  const { workspaces, workspace } = useWorkspace();
  const [record, setRecord] = useState<DomainDnsRecord | null>(null);
  const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["domain-capabilities", workspaceId], queryFn: () => domainsClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const domains = useQuery({ queryKey: ["domains", workspaceId], queryFn: () => domainsClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  const options = useQuery({ queryKey: ["domain-options", workspaceId], queryFn: () => domainsClient.available(workspaceId!), enabled: Boolean(workspaceId) });

  if (workspaces.isPending) return <Page className="domains-page"><div className="domains-centered"><Spinner label={text("Loading workspaces", "正在读取工作区")} /></div></Page>;
  if (workspaces.isError) return <Page className="domains-page"><ErrorState title={text("Could not load workspaces", "无法读取工作区")} description={localized(errorMessage(workspaces.error), locale)} action={<Button type="button" onClick={() => workspaces.refetch()}>{text("Try again", "重试")}</Button>} /></Page>;
  if (!workspace) return <Page className="domains-page"><EmptyState title={text("No workspace yet", "还没有工作区")} description={text("Create or join a workspace before adding domains for short links and public pages.", "创建或加入工作区后，才能为短链接和公开页面配置域名。") } /></Page>;

  const canManage = capabilities.data?.can_manage === true;
  const domainRows = domains.data?.data ?? [];
  const domainOptions = options.data?.data ?? [];
  const official = domainOptions.filter((item) => item.source === "official");
  const customAvailable = domainOptions.filter((item) => item.source === "custom");

  return <Page className="domains-page" data-p06-domains>
    <PageHeader
      title={text("Domains", "域名")}
      description={text(`Choose which domains can be used by short links and public pages in ${workspace.name}. Add a custom domain, complete DNS ownership verification, wait for HTTPS to become available, then select the domain when creating content.`, `管理 ${workspace.name} 中短链接和公开页面可以使用的域名。添加自定义域名后需要完成 DNS 所有权验证，并等待 HTTPS 可用，之后才能在创建内容时选择该域名。`)}
      actions={canManage ? <SideSheet triggerLabel={text("Add domain", "添加域名")} title={text("Add custom domain", "添加自定义域名")} description={text("Enter a hostname you control. GoJet will provide a TXT record for ownership verification and will check HTTPS readiness before the domain becomes available for published content.", "填写你控制的主机名。GoJet 会提供用于验证所有权的 TXT 记录，并检查 HTTPS 是否就绪；全部完成后该域名才会出现在可发布内容的域名列表中。") }><AddDomainForm workspaceId={workspace.id} /></SideSheet> : undefined}
    />
    {capabilities.data && !canManage ? <Alert tone="warning" title={text("Domain settings are read-only", "当前只能查看域名设置")}>{text(`Your current workspace role is ${capabilities.data.role}. You can review domain status, but a member with domain-management permission must add domains, generate new verification records or run verification.`, `当前工作区角色为 ${capabilities.data.role}。你可以查看域名状态，但添加域名、重新生成验证记录或执行验证需要由具备域名管理权限的成员完成。`)}</Alert> : null}
    {capabilities.isError ? <Alert tone="danger" title={text("Could not check domain permissions", "无法确认域名权限")}>{localized(errorMessage(capabilities.error), locale)}</Alert> : null}

    <section className="domain-summary-grid" aria-label={text("Domain summary", "域名概况")}>
      <article><span>{text("GoJet domains", "GoJet 官方域名")}</span><strong>{official.length}</strong><small>{text("Provided by this GoJet site", "由当前 GoJet 站点提供")}</small></article>
      <article><span>{text("Verified custom domains", "已验证自定义域名")}</span><strong>{customAvailable.length}</strong><small>{text("DNS and HTTPS are ready", "DNS 与 HTTPS 均已就绪")}</small></article>
      <article><span>{text("Custom domains added", "已添加自定义域名")}</span><strong>{domainRows.length}</strong><small>{text("Includes pending and failed checks", "包含待验证和检查异常的域名")}</small></article>
    </section>

    <section className="domain-section" aria-labelledby="available-domains-title">
      <div className="domain-section-head"><div><span className="domain-eyebrow">{text("AVAILABLE DOMAINS", "可用域名")}</span><h2 id="available-domains-title">{text("Domains ready for publishing", "可以用于发布内容的域名")}</h2><p>{text("This list contains the GoJet domains and verified custom domains that are currently ready to use when you create a short link or another supported public resource.", "这里列出当前已经可以在创建短链接或其他公开内容时直接使用的 GoJet 官方域名和已验证自定义域名。")}</p></div></div>
      {options.isPending ? <div className="domains-centered"><Spinner label={text("Loading available domains", "正在加载可用域名")} /></div> : options.isError ? <ErrorState title={text("Could not load available domains", "无法加载可用域名")} description={localized(errorMessage(options.error), locale)} action={<Button type="button" onClick={() => options.refetch()}>{text("Try again", "重试")}</Button>} /> : domainOptions.length ? <div className="domain-option-grid">{domainOptions.map((item) => <DomainOption key={`${item.source}-${item.hostname}`} item={item} />)}</div> : <EmptyState title={text("No domains are ready yet", "暂时没有可用域名")} description={text("Add and verify a custom domain, or ask the site administrator whether an official domain is available for this workspace.", "可以添加并验证自定义域名，或者联系站点管理员确认当前工作区是否可以使用官方域名。") } />}
    </section>

    {record ? <section className="domain-record-panel"><div className="domain-section-head"><div><span className="domain-eyebrow">{text("DNS VERIFICATION", "DNS 验证")}</span><h2>{text("Current verification record", "当前验证记录")}</h2></div><Button size="sm" variant="outline" type="button" onClick={() => setRecord(null)}>{text("Close", "关闭")}</Button></div><DnsRecord record={record} /></section> : null}

    <section className="domain-section" aria-labelledby="custom-domains-title">
      <div className="domain-section-head"><div><span className="domain-eyebrow">{text("CUSTOM DOMAINS", "自定义域名")}</span><h2 id="custom-domains-title">{text("Ownership and HTTPS status", "所有权与 HTTPS 状态")}</h2><p>{text("Each custom domain must prove ownership with the TXT record shown by GoJet and must support HTTPS before it can be selected for public content. The status below reflects the latest recorded checks.", "每个自定义域名都需要使用 GoJet 提供的 TXT 记录完成所有权验证，并且 HTTPS 可用后才能被公开内容选择。下面的状态显示最近一次实际检查结果。")}</p></div></div>
      {domains.isPending ? <div className="domains-centered"><Spinner label={text("Loading custom domains", "正在加载自定义域名")} /></div> : domains.isError ? <ErrorState title={text("Could not load custom domains", "无法加载自定义域名")} description={localized(errorMessage(domains.error), locale)} action={<Button type="button" onClick={() => domains.refetch()}>{text("Try again", "重试")}</Button>} /> : domainRows.length ? <div className="domain-card-grid">{domainRows.map((item) => <DomainCard key={item.id} item={item} workspaceId={workspace.id} canManage={canManage} onRecord={setRecord} />)}</div> : <EmptyState title={text("No custom domains", "还没有自定义域名")} description={text("Add a dedicated hostname such as go.example.com, publish the TXT verification record, then complete ownership and HTTPS checks before using it for public content.", "添加一个专用主机名（例如 go.example.com），配置 TXT 验证记录，并在所有权和 HTTPS 检查完成后再用于公开内容。") } />}
    </section>
  </Page>;
}
