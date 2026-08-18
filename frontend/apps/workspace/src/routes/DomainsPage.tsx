import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { createDomainsClient, type DomainDnsRecord, type DomainRecord, type LinkDomainOption, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
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
  const tone = value === "active" ? "success" : value === "pending" ? "warning" : "neutral";
  const label = value === "active" ? "Active" : value === "pending" ? "Pending" : value === "error" ? "Error" : value;
  return <Badge tone={tone}>{label}</Badge>;
}

function DnsRecord({ record }: { record: DomainDnsRecord }) {
  return <section className="domain-dns-record" aria-label="DNS verification record">
    <div><span>Type</span><strong>{record.type}</strong></div>
    <div><span>Name</span><code>{record.name}</code></div>
    <div><span>Value</span><code>{record.value}</code></div>
    <p>在域名 DNS 管理中添加这条 TXT 记录。解析生效后返回 GoJet 点击 Verify now；重新生成记录后旧记录会立即失效。</p>
  </section>;
}

function AddDomainForm({ workspaceId }: { workspaceId: number }) {
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
    {mutation.isError ? <Alert tone="danger" title="无法添加域名">{errorMessage(mutation.error)}</Alert> : null}
    {mutation.data ? <><Alert tone="warning" title="等待 DNS 验证">域名已保存。添加下方 TXT 记录后再执行验证。</Alert><DnsRecord record={mutation.data.dns_record} /></> : null}
    <Field label="Domain" htmlFor="domain-hostname" required help="仅填写主机名，例如 go.example.com；不要包含协议、路径、端口或 IP。">
      <Input id="domain-hostname" value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="go.example.com" autoComplete="off" required />
    </Field>
    <div className="domain-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!hostname.trim()}>Generate verification record</Button></div>
  </form>;
}

function DomainCard({ item, workspaceId, canManage, onRecord }: { item: DomainRecord; workspaceId: number; canManage: boolean; onRecord: (record: DomainDnsRecord | null) => void }) {
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
      <div><span className="domain-host-label">Custom domain</span><h2>{item.hostname}</h2></div>
      <Badge tone={usable ? "success" : "warning"}>{usable ? "Ready" : "Not ready"}</Badge>
    </div>
    <div className="domain-state-grid">
      <div><span>DNS ownership</span><StateBadge value={item.status} /></div>
      <div><span>HTTPS</span><StateBadge value={item.https_status} /></div>
      <div><span>Last checked</span><strong>{formatDate(item.last_checked_at)}</strong></div>
      <div><span>Short links</span><strong>{usable ? "Available" : "Unavailable"}</strong></div>
    </div>
    {item.last_error ? <Alert tone="danger" title="Domain check failed">{item.last_error}</Alert> : null}
    {mutationError ? <Alert tone="danger" title="Domain action failed">{errorMessage(mutationError)}</Alert> : null}
    {canManage ? <div className="domain-actions">
      <Button size="sm" type="button" loading={verify.isPending} onClick={() => verify.mutate()}>Verify now</Button>
      {!usable ? <Button size="sm" variant="outline" type="button" loading={rotate.isPending} onClick={() => rotate.mutate()}>Regenerate TXT</Button> : null}
    </div> : null}
  </article>;
}

function DomainOption({ item }: { item: LinkDomainOption }) {
  return <article className="domain-option-card">
    <div><span>{item.source === "official" ? "GoJet official" : "Verified custom"}</span><strong>{item.hostname}</strong></div>
    <div>{item.is_default ? <Badge tone="success">Default</Badge> : <Badge tone="neutral">Available</Badge>}</div>
  </article>;
}

export default function DomainsPage() {
  const { workspaces, workspace } = useWorkspace();
  const [record, setRecord] = useState<DomainDnsRecord | null>(null);
  const workspaceId = workspace?.id;
  const capabilities = useQuery({ queryKey: ["domain-capabilities", workspaceId], queryFn: () => domainsClient.capabilities(workspaceId!), enabled: Boolean(workspaceId) });
  const domains = useQuery({ queryKey: ["domains", workspaceId], queryFn: () => domainsClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  const options = useQuery({ queryKey: ["domain-options", workspaceId], queryFn: () => domainsClient.available(workspaceId!), enabled: Boolean(workspaceId) });

  if (workspaces.isPending) return <Page className="domains-page"><div className="domains-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="domains-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace) return <Page className="domains-page"><EmptyState title="还没有工作区" description="创建工作区后才能配置短链域名。" /></Page>;

  const canManage = capabilities.data?.can_manage === true;
  const domainRows = domains.data?.data ?? [];
  const domainOptions = options.data?.data ?? [];
  const official = domainOptions.filter((item) => item.source === "official");
  const customAvailable = domainOptions.filter((item) => item.source === "custom");

  return <Page className="domains-page" data-p06-domains>
    <PageHeader title="Domains" description={`Short-link domain control · ${workspace.name}`} actions={canManage ? <SideSheet triggerLabel="Add domain" title="Add custom domain" description="验证 DNS 所有权与 HTTPS 后，域名才会进入短链接可用列表。"><AddDomainForm workspaceId={workspace.id} /></SideSheet> : undefined} />
    {capabilities.data && !canManage ? <Alert tone="warning" title="Read-only domain access">当前角色为 {capabilities.data.role}。可以查看域名状态，但只有具备 manage 权限的成员可以添加、轮换验证记录或执行验证。</Alert> : null}
    {capabilities.isError ? <Alert tone="danger" title="无法确认域名权限">{errorMessage(capabilities.error)}</Alert> : null}

    <section className="domain-summary-grid" aria-label="Domain summary">
      <article><span>Official domains</span><strong>{official.length}</strong><small>由 GoJet 平台提供</small></article>
      <article><span>Verified custom</span><strong>{customAvailable.length}</strong><small>DNS + HTTPS 已就绪</small></article>
      <article><span>Configured custom</span><strong>{domainRows.length}</strong><small>包含待验证与异常域名</small></article>
    </section>

    <section className="domain-section" aria-labelledby="available-domains-title">
      <div className="domain-section-head"><div><span className="domain-eyebrow">URL SYSTEM</span><h2 id="available-domains-title">Available short-link domains</h2><p>这里只展示后端已判定可用于创建短链接的官方域名和自定义域名。</p></div></div>
      {options.isPending ? <div className="domains-centered"><Spinner label="正在加载可用域名" /></div> : options.isError ? <ErrorState title="无法加载可用域名" description={errorMessage(options.error)} action={<Button type="button" onClick={() => options.refetch()}>重试</Button>} /> : domainOptions.length ? <div className="domain-option-grid">{domainOptions.map((item) => <DomainOption key={`${item.source}-${item.hostname}`} item={item} />)}</div> : <EmptyState title="No short-link domains available" description="当前没有后端判定为可用的短链域名。" />}
    </section>

    {record ? <section className="domain-record-panel"><div className="domain-section-head"><div><span className="domain-eyebrow">DNS VERIFICATION</span><h2>Current verification record</h2></div><Button size="sm" variant="outline" type="button" onClick={() => setRecord(null)}>Dismiss</Button></div><DnsRecord record={record} /></section> : null}

    <section className="domain-section" aria-labelledby="custom-domains-title">
      <div className="domain-section-head"><div><span className="domain-eyebrow">CUSTOM DOMAINS</span><h2 id="custom-domains-title">Ownership & HTTPS status</h2><p>GoJet 服务端执行 TXT 所有权检查和 TLS 握手；浏览器不会自行判定域名是否安全可用。</p></div></div>
      {domains.isPending ? <div className="domains-centered"><Spinner label="正在加载自定义域名" /></div> : domains.isError ? <ErrorState title="无法加载自定义域名" description={errorMessage(domains.error)} action={<Button type="button" onClick={() => domains.refetch()}>重试</Button>} /> : domainRows.length ? <div className="domain-card-grid">{domainRows.map((item) => <DomainCard key={item.id} item={item} workspaceId={workspace.id} canManage={canManage} onRecord={setRecord} />)}</div> : <EmptyState title="No custom domains" description="添加专用子域名后，按 TXT 记录完成所有权验证与 HTTPS 检查。" />}
    </section>
  </Page>;
}
