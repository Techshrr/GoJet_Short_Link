import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createQRClient, resourceAccess, type LinkRiskPresentation, type QRCodeRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

const qrClient = createQRClient(api);

type ExportFormat = "png" | "svg" | "pdf";

function useWorkspace() {
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[])
  });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function requestState(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 403) return { title: "Permission denied", body: "当前成员角色没有执行该二维码操作的权限。" };
  if (error.status === 429) return { title: "Rate limited", body: "请求过于频繁，请稍后再试。" };
  if (error.status === 402 || error.status === 409) return { title: "Quota exceeded", body: "当前套餐的二维码额度不足，请先调整额度或套餐。" };
  if (error.status === 503) return { title: "QR service unavailable", body: "二维码服务当前不可用；GoJet 不会用本地假数据替代后端状态。" };
  return null;
}

function safeLinks(risks: LinkRiskPresentation[] | undefined) {
  const byLink = new Map((risks ?? []).map((item) => [item.link_id, item]));
  return (linkId: number) => {
    const risk = byLink.get(linkId);
    return risk ? !risk.pending && risk.effective_decision === "allow" : false;
  };
}

function QRCreateForm({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const links = useQuery({ queryKey: ["qr-link-options", workspaceId], queryFn: () => linksClient.list(workspaceId, { status: "active", limit: 100 }) });
  const risks = useQuery({ queryKey: ["qr-link-risks", workspaceId], queryFn: () => linksClient.risks(workspaceId) });
  const [linkId, setLinkId] = useState(0);
  const [name, setName] = useState("");
  const [size, setSize] = useState(1024);
  const [foreground, setForeground] = useState("#10233f");
  const [background, setBackground] = useState("#ffffff");
  const [format, setFormat] = useState<ExportFormat>("png");
  const riskAllows = useMemo(() => safeLinks(risks.data?.data), [risks.data]);
  const allowedLinks = (links.data?.data ?? []).filter((item) => riskAllows(item.id));
  const previewUrl = linkId ? linksClient.qrUrl(workspaceId, linkId, { format: "png", size, foreground, background }) : "";

  const mutation = useMutation({
    mutationFn: () => qrClient.create(workspaceId, { link_id: linkId, name: name.trim(), size, foreground, background }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["qr-codes", workspaceId] });
      setName("");
    }
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canEdit && linkId > 0 && name.trim()) mutation.mutate();
  };
  const special = requestState(mutation.error);

  return <form className="resource-create-form" onSubmit={submit} data-qr-create-form>
    {!canEdit ? <Alert tone="warning" title="Read-only">当前角色可以查看二维码，但不能创建或删除。</Alert> : null}
    {links.isError || risks.isError ? <Alert tone="danger" title="无法确认可创建短链">安全状态由服务端决定；风险信息不可用时不会放行二维码创建。</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : mutation.isError ? <Alert tone="danger" title="创建失败">{errorMessage(mutation.error)}</Alert> : null}
    {mutation.isSuccess ? <Alert tone="success" title="QR created">二维码已保存，列表与扫描统计会从服务端重新读取。</Alert> : null}

    <Field label="Destination link" htmlFor="qr-link" required help="仅列出当前处于 active 且风险状态明确 allow 的短链接；服务端仍会再次校验。">
      <select id="qr-link" className="resource-select" value={linkId || ""} onChange={(event) => setLinkId(Number(event.target.value))} required>
        <option value="">Select a safe link</option>
        {allowedLinks.map((item) => <option key={item.id} value={item.id}>{item.title || item.code} · {shortUrl(item.domain, item.code)}</option>)}
      </select>
    </Field>
    <Field label="Name" htmlFor="qr-name" required><Input id="qr-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign QR" required /></Field>
    <div className="resource-form-grid">
      <Field label="Size" htmlFor="qr-size"><select id="qr-size" className="resource-select" value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={512}>512 px</option><option value={768}>768 px</option><option value={1024}>1024 px</option><option value={1600}>1600 px</option><option value={2048}>2048 px</option></select></Field>
      <Field label="Export format" htmlFor="qr-format" help="Stored QR configuration is format-neutral; export is generated by the accepted Link QR endpoint."><select id="qr-format" className="resource-select" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="svg">SVG</option><option value="pdf">PDF</option></select></Field>
      <Field label="Foreground" htmlFor="qr-fg"><Input id="qr-fg" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></Field>
      <Field label="Background" htmlFor="qr-bg"><Input id="qr-bg" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></Field>
    </div>
    <section className="qr-live-preview" aria-label="QR live preview">
      {previewUrl ? <><img src={previewUrl} alt="Live QR preview" /><a className="resource-download-link" href={linksClient.qrUrl(workspaceId, linkId, { format, size, foreground, background, download: true })}>Preview export · {format.toUpperCase()}</a></> : <p>Select a safe link to preview the QR.</p>}
      <small>Logo/error-correction controls stay hidden because the current backend capability does not expose them. V5 does not fake unsupported controls.</small>
    </section>
    <div className="resource-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!canEdit || !linkId || !name.trim()}>Create QR</Button></div>
  </form>;
}

function QRDetail({ item, workspaceId, canEdit, onDelete }: { item: QRCodeRecord; workspaceId: number; canEdit: boolean; onDelete: () => void }) {
  const target = shortUrl(item.domain ?? "", item.code ?? "");
  return <article className="qr-detail-panel" data-qr-detail>
    <div className="resource-detail-head"><div><span className="resource-eyebrow">QR DETAIL</span><h2>{item.name}</h2><p>{target}</p></div><Badge tone="success">Active</Badge></div>
    <div className="qr-detail-grid">
      <img src={item.image_url} alt={`${item.name} QR code`} />
      <dl>
        <div><dt>Scans</dt><dd>{item.qr_visits}</dd></div>
        <div><dt>Size</dt><dd>{item.size}px</dd></div>
        <div><dt>Created</dt><dd>{formatDate(item.created_at)}</dd></div>
        <div><dt>Target</dt><dd>{target}</dd></div>
      </dl>
    </div>
    <div className="resource-actions">
      {(["png", "svg", "pdf"] as ExportFormat[]).map((format) => <a key={format} className="resource-download-link" href={linksClient.qrUrl(workspaceId, item.link_id, { format, size: item.size, foreground: item.foreground, background: item.background, download: true })}>Download {format.toUpperCase()}</a>)}
      <a className="resource-download-link" href={`/app/analytics?link=${item.link_id}`}>Open analytics</a>
      {canEdit ? <Button variant="destructive" size="sm" type="button" onClick={onDelete}>Delete QR</Button> : null}
    </div>
  </article>;
}

export default function QRPage() {
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const workspaceId = workspace?.id;
  const qrs = useQuery({ queryKey: ["qr-codes", workspaceId], queryFn: () => qrClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  const access = workspace ? resourceAccess(workspace.role) : null;
  const remove = useMutation({ mutationFn: (qrId: number) => qrClient.delete(workspaceId!, qrId), onSuccess: async () => { setSelectedId(null); await queryClient.invalidateQueries({ queryKey: ["qr-codes", workspaceId] }); } });

  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace || !access) return <Page className="resources-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理二维码。" /></Page>;

  const rows = qrs.data?.data ?? [];
  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const listState = requestState(qrs.error);

  return <Page className="resources-page" data-p08-qr>
    <PageHeader title="QR Codes" description={`Create, style, export and measure QR distribution · ${workspace.name}`} actions={access.can_edit ? <SideSheet triggerLabel="Create QR" title="Create QR code" description="Destination safety is enforced again by the Go API before a QR can be created."><QRCreateForm workspaceId={workspace.id} canEdit={access.can_edit} /></SideSheet> : undefined} />
    {!access.can_edit ? <Alert tone="warning" title="Read-only QR access">当前角色为 {workspace.role}。可以查看二维码与扫描统计，但创建和删除由 RBAC 禁止。</Alert> : null}
    {remove.isError ? <Alert tone="danger" title="无法删除二维码">{errorMessage(remove.error)}</Alert> : null}

    <section className="resource-summary-grid" aria-label="QR summary"><article><span>QR codes</span><strong>{rows.length}</strong><small>当前工作区</small></article><article><span>Total scans</span><strong>{rows.reduce((sum, item) => sum + item.qr_visits, 0)}</strong><small>visit_type = qr</small></article><article><span>Export</span><strong>3</strong><small>PNG · SVG · PDF</small></article></section>

    <section className="resource-section" aria-labelledby="qr-list-title">
      <div className="resource-section-head"><div><span className="resource-eyebrow">DISTRIBUTION</span><h2 id="qr-list-title">QR library</h2><p>预览、目标、扫描量与样式均来自真实资源；安全放行权仍在服务端。</p></div></div>
      {qrs.isPending ? <div className="resources-centered"><Spinner label="正在加载二维码" /></div> : listState ? <ErrorState title={listState.title} description={listState.body} action={<Button type="button" onClick={() => qrs.refetch()}>重试</Button>} /> : qrs.isError ? <ErrorState title="无法加载二维码" description={errorMessage(qrs.error)} action={<Button type="button" onClick={() => qrs.refetch()}>重试</Button>} /> : rows.length ? <div className="qr-resource-list">{rows.map((item) => <button type="button" key={item.id} className="qr-resource-row" onClick={() => setSelectedId(item.id)}><img src={item.image_url} alt="" /><span><strong>{item.name}</strong><small>{shortUrl(item.domain ?? "", item.code ?? "")}</small></span><span><strong>{item.qr_visits}</strong><small>scans</small></span><span><strong>{formatDate(item.created_at)}</strong><small>updated</small></span></button>)}</div> : <EmptyState title="No QR codes" description={access.can_edit ? "Create a QR from an active link that has passed destination risk review." : "当前工作区还没有二维码。"} />}
    </section>
    {selected ? <QRDetail item={selected} workspaceId={workspace.id} canEdit={access.can_edit} onDelete={() => remove.mutate(selected.id)} /> : null}
  </Page>;
}
