import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createQRClient, resourceAccess, type LinkRiskPresentation, type QRCodeRecord, type WorkspaceSummary } from "@gojet/api-client";
import { qrPaletteDefaults } from "@gojet/tokens";
import { Alert, Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
import { localized, useLocale, type GoJetLocale } from "@gojet/ui/locale";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId, shortUrl } from "../links/client";

const qrClient = createQRClient(api);
type ExportFormat = "png" | "svg" | "pdf";

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  const workspace = workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0];
  return { workspaces, workspace };
}

function requestState(error: unknown, locale: GoJetLocale) {
  const zh = locale === "zh-CN";
  if (!(error instanceof ApiError)) return null;
  if (error.status === 403) return { title: zh ? "没有操作权限" : "Permission denied", body: zh ? "当前成员角色没有执行此二维码操作的权限。" : "Your current workspace role cannot perform this QR-code action." };
  if (error.status === 429) return { title: zh ? "操作过于频繁" : "Too many requests", body: zh ? "请求过于频繁，请稍后再试。" : "Too many requests were made in a short period. Wait a moment and try again." };
  if (error.status === 402 || error.status === 409) return { title: zh ? "二维码额度不足" : "QR-code limit reached", body: zh ? "当前套餐的二维码额度不足，请先查看套餐或调整使用量。" : "This workspace has reached its current QR-code allowance. Review the plan or reduce existing usage before creating another code." };
  if (error.status === 503) return { title: zh ? "二维码服务暂时不可用" : "QR-code service unavailable", body: zh ? "二维码服务暂时无法完成请求，请稍后重试。现有二维码和统计数据不会被示例内容替代。" : "The QR-code service cannot complete this request right now. Try again later; existing codes and statistics will not be replaced with sample data." };
  return null;
}

function safeLinks(risks: LinkRiskPresentation[] | undefined) {
  const byLink = new Map((risks ?? []).map((item) => [item.link_id, item]));
  return (linkId: number) => { const risk = byLink.get(linkId); return risk ? !risk.pending && risk.effective_decision === "allow" : false; };
}

function QRCreateForm({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const { locale, text } = useLocale();
  const queryClient = useQueryClient();
  const links = useQuery({ queryKey: ["qr-link-options", workspaceId], queryFn: () => linksClient.list(workspaceId, { status: "active", limit: 100 }) });
  const risks = useQuery({ queryKey: ["qr-link-risks", workspaceId], queryFn: () => linksClient.risks(workspaceId) });
  const [linkId, setLinkId] = useState(0);
  const [name, setName] = useState("");
  const [size, setSize] = useState(1024);
  const [foreground, setForeground] = useState<string>(qrPaletteDefaults.foreground);
  const [background, setBackground] = useState<string>(qrPaletteDefaults.background);
  const [format, setFormat] = useState<ExportFormat>("png");
  const riskAllows = useMemo(() => safeLinks(risks.data?.data), [risks.data]);
  const allowedLinks = (links.data?.data ?? []).filter((item) => riskAllows(item.id));
  const previewUrl = linkId ? linksClient.qrUrl(workspaceId, linkId, { format: "png", size, foreground, background }) : "";
  const mutation = useMutation({ mutationFn: () => qrClient.create(workspaceId, { link_id: linkId, name: name.trim(), size, foreground, background }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["qr-codes", workspaceId] }); setName(""); } });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (canEdit && linkId > 0 && name.trim()) mutation.mutate(); };
  const special = requestState(mutation.error, locale);

  return <form className="resource-create-form" onSubmit={submit} data-qr-create-form>
    {!canEdit ? <Alert tone="warning" title={text("Read-only access", "当前只能查看")}>{text("You can view QR codes and scan counts, but your workspace role cannot create or delete QR codes.", "你可以查看二维码和扫描量，但当前工作区角色不能创建或删除二维码。")}</Alert> : null}
    {links.isError || risks.isError ? <Alert tone="danger" title={text("Could not check available links", "无法确认可用短链接")}>{text("GoJet could not confirm which active links are currently allowed for QR creation. Refresh the page or try again later before creating a code.", "GoJet 暂时无法确认哪些已启用短链接可以用于创建二维码。请刷新页面或稍后重试，确认状态后再创建。")}</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : mutation.isError ? <Alert tone="danger" title={text("Could not create QR code", "二维码创建失败")}>{localized(errorMessage(mutation.error), locale)}</Alert> : null}
    {mutation.isSuccess ? <Alert tone="info" title={text("QR code created", "二维码已创建")}>{text("The QR code has been saved. The list and scan counts below will refresh from the latest saved data.", "二维码已经保存，下面的列表和扫描统计会重新读取最新数据。")}</Alert> : null}
    <Field label={text("Destination link", "目标短链接")} htmlFor="qr-link" required help={text("Only active links that have completed the required destination checks are shown here. If a link is missing, review that link's current status first.", "这里只显示已启用并完成必要目标地址检查的短链接。如果某条链接没有出现，请先查看该短链接当前状态。") }>
      <select id="qr-link" className="resource-select" value={linkId || ""} onChange={(event) => setLinkId(Number(event.target.value))} required><option value="">{text("Select a link", "选择短链接")}</option>{allowedLinks.map((item) => <option key={item.id} value={item.id}>{item.title || item.code} · {shortUrl(item.domain, item.code)}</option>)}</select>
    </Field>
    <Field label={text("Name", "名称")} htmlFor="qr-name" required help={text("Use a name that makes this QR code easy to identify inside your workspace.", "填写一个便于在工作区中识别用途的名称。") }><Input id="qr-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={text("Campaign QR", "活动二维码")} required /></Field>
    <div className="resource-form-grid">
      <Field label={text("Image size", "图片尺寸")} htmlFor="qr-size"><select id="qr-size" className="resource-select" value={size} onChange={(event) => setSize(Number(event.target.value))}><option value={512}>512 px</option><option value={768}>768 px</option><option value={1024}>1024 px</option><option value={1600}>1600 px</option><option value={2048}>2048 px</option></select></Field>
      <Field label={text("Download format", "下载格式")} htmlFor="qr-format" help={text("Choose the file format you want when previewing or downloading this QR code. The saved QR code can be downloaded in any currently supported format later.", "选择预览或下载时需要的文件格式。二维码保存后，仍可以随时下载当前支持的其他格式。") }><select id="qr-format" className="resource-select" value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="png">PNG</option><option value="svg">SVG</option><option value="pdf">PDF</option></select></Field>
      <Field label={text("Code color", "二维码颜色")} htmlFor="qr-fg"><Input id="qr-fg" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></Field>
      <Field label={text("Background color", "背景颜色")} htmlFor="qr-bg"><Input id="qr-bg" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></Field>
    </div>
    <section className="qr-live-preview" aria-label={text("QR code preview", "二维码预览")}>
      {previewUrl ? <><img src={previewUrl} alt={text("QR code preview", "二维码预览")} /><a className="resource-download-link" href={linksClient.qrUrl(workspaceId, linkId, { format, size, foreground, background, download: true })}>{text("Preview download", "预览下载")} · {format.toUpperCase()}</a></> : <p>{text("Select a destination link to preview the QR code.", "选择目标短链接后即可预览二维码。")}</p>}
      <small>{text("The controls shown here are the appearance options currently available for saved QR codes. Additional styling options will appear only when they are supported by the service used by this installation.", "这里显示的是当前二维码功能实际支持的外观选项。只有站点所使用的二维码服务支持新的样式设置后，相应选项才会出现在这里。")}</small>
    </section>
    <div className="resource-sheet-footer"><Button type="submit" loading={mutation.isPending} disabled={!canEdit || !linkId || !name.trim()}>{text("Create QR code", "创建二维码")}</Button></div>
  </form>;
}

function QRDetail({ item, workspaceId, canEdit, onDelete }: { item: QRCodeRecord; workspaceId: number; canEdit: boolean; onDelete: () => void }) {
  const { text } = useLocale();
  const target = shortUrl(item.domain ?? "", item.code ?? "");
  return <article className="qr-detail-panel" data-qr-detail>
    <div className="resource-detail-head"><div><span className="resource-eyebrow">{text("QR CODE DETAILS", "二维码详情")}</span><h2>{item.name}</h2><p>{target}</p></div><Badge tone="success">{text("Active", "正常")}</Badge></div>
    <div className="qr-detail-grid"><img src={item.image_url} alt={text(`${item.name} QR code`, `${item.name} 二维码`)} /><dl><div><dt>{text("Scans", "扫描量")}</dt><dd>{item.qr_visits}</dd></div><div><dt>{text("Size", "尺寸")}</dt><dd>{item.size}px</dd></div><div><dt>{text("Created", "创建时间")}</dt><dd>{formatDate(item.created_at)}</dd></div><div><dt>{text("Destination", "目标地址")}</dt><dd>{target}</dd></div></dl></div>
    <div className="resource-actions">
      {(["png", "svg", "pdf"] as ExportFormat[]).map((format) => <a key={format} className="resource-download-link" href={linksClient.qrUrl(workspaceId, item.link_id, { format, size: item.size, foreground: item.foreground, background: item.background, download: true })}>{text("Download", "下载")} {format.toUpperCase()}</a>)}
      <a className="resource-download-link" href={`/app/analytics?link=${item.link_id}`}>{text("View scan analytics", "查看扫描数据")}</a>
      {canEdit ? <Dialog triggerLabel={text("Delete QR code", "删除二维码")} title={text("Delete this QR code?", "删除这个二维码？")} description={text("The saved QR code will be removed, but its destination short link will remain unchanged.", "保存的二维码会被删除，但对应的目标短链接不会发生变化。") } confirmLabel={text("Delete QR code", "删除二维码")} destructive onConfirm={onDelete}><p>{text("After deletion, this QR-code record and its generated image cannot be restored from this page.", "删除后，此二维码记录和生成的图片无法从当前页面恢复。")}</p></Dialog> : null}
    </div>
  </article>;
}

export default function QRPage() {
  const { locale, text } = useLocale();
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const workspaceId = workspace?.id;
  const qrs = useQuery({ queryKey: ["qr-codes", workspaceId], queryFn: () => qrClient.list(workspaceId!), enabled: Boolean(workspaceId) });
  const access = workspace ? resourceAccess(workspace.role) : null;
  const remove = useMutation({ mutationFn: (qrId: number) => qrClient.delete(workspaceId!, qrId), onSuccess: async () => { setSelectedId(null); await queryClient.invalidateQueries({ queryKey: ["qr-codes", workspaceId] }); } });
  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label={text("Loading workspaces", "正在读取工作区")} /></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title={text("Could not load workspaces", "无法读取工作区")} description={localized(errorMessage(workspaces.error), locale)} action={<Button type="button" onClick={() => workspaces.refetch()}>{text("Try again", "重试")}</Button>} /></Page>;
  if (!workspace || !access) return <Page className="resources-page"><EmptyState title={text("No workspace yet", "还没有工作区")} description={text("Create or join a workspace before managing QR codes.", "创建或加入工作区后才能管理二维码。") } /></Page>;
  const rows = qrs.data?.data ?? [];
  const selected = rows.find((item) => item.id === selectedId) ?? null;
  const listState = requestState(qrs.error, locale);

  return <Page className="resources-page" data-p08-qr>
    <PageHeader title={text("QR Codes", "二维码")} description={text(`Create QR codes for the links in ${workspace.name}, preview their appearance, download PNG, SVG or PDF files, and review recorded scan counts from the same workspace.`, `为 ${workspace.name} 中的短链接创建二维码，预览实际外观，下载 PNG、SVG 或 PDF 文件，并在同一工作区查看已记录的扫描量。`)} actions={access.can_edit ? <SideSheet triggerLabel={text("Create QR code", "创建二维码")} title={text("Create QR code", "创建二维码")} description={text("Choose an active destination link, give the QR code an internal name, select its size and colors, then preview it before saving.", "选择已启用的目标短链接，填写便于识别的名称，设置尺寸和颜色，并在保存前确认预览效果。") }><QRCreateForm workspaceId={workspace.id} canEdit={access.can_edit} /></SideSheet> : undefined} />
    {!access.can_edit ? <Alert tone="warning" title={text("QR codes are read-only", "当前只能查看二维码")}>{text(`Your current workspace role is ${workspace.role}. You can view QR codes and scan counts, but creating or deleting QR codes requires a role with content-editing permission.`, `当前工作区角色为 ${workspace.role}。你可以查看二维码和扫描统计，但创建或删除二维码需要具备内容编辑权限。`)}</Alert> : null}
    {remove.isError ? <Alert tone="danger" title={text("Could not delete QR code", "无法删除二维码")}>{localized(errorMessage(remove.error), locale)}</Alert> : null}
    <section className="resource-summary-grid" aria-label={text("QR-code summary", "二维码概况")}><article><span>{text("QR codes", "二维码数量")}</span><strong>{rows.length}</strong><small>{text("Saved in this workspace", "当前工作区已保存")}</small></article><article><span>{text("Total scans", "总扫描量")}</span><strong>{rows.reduce((sum, item) => sum + item.qr_visits, 0)}</strong><small>{text("Recorded QR visits", "已记录二维码访问")}</small></article><article><span>{text("Download formats", "下载格式")}</span><strong>3</strong><small>PNG · SVG · PDF</small></article></section>
    <section className="resource-section" aria-labelledby="qr-list-title">
      <div className="resource-section-head"><div><span className="resource-eyebrow">{text("SAVED QR CODES", "已保存二维码")}</span><h2 id="qr-list-title">{text("QR-code list", "二维码列表")}</h2><p>{text("Open a QR code to review its destination, appearance, creation time and recorded scan count, or download it in another supported format.", "打开任意二维码即可查看目标短链接、外观、创建时间和已记录扫描量，也可以下载其他支持的文件格式。")}</p></div></div>
      {qrs.isPending ? <div className="resources-centered"><Spinner label={text("Loading QR codes", "正在加载二维码")} /></div> : listState ? <ErrorState title={listState.title} description={listState.body} action={<Button type="button" onClick={() => qrs.refetch()}>{text("Try again", "重试")}</Button>} /> : qrs.isError ? <ErrorState title={text("Could not load QR codes", "无法加载二维码")} description={localized(errorMessage(qrs.error), locale)} action={<Button type="button" onClick={() => qrs.refetch()}>{text("Try again", "重试")}</Button>} /> : rows.length ? <div className="qr-resource-list">{rows.map((item) => <button type="button" key={item.id} className="qr-resource-row" onClick={() => setSelectedId(item.id)}><img src={item.image_url} alt="" /><span><strong>{item.name}</strong><small>{shortUrl(item.domain ?? "", item.code ?? "")}</small></span><span><strong>{item.qr_visits}</strong><small>{text("scans", "次扫描")}</small></span><span><strong>{formatDate(item.created_at)}</strong><small>{text("created", "创建")}</small></span></button>)}</div> : <EmptyState title={text("No QR codes yet", "还没有二维码")} description={access.can_edit ? text("Create a QR code from an active link that is currently available for QR publishing.", "选择当前可以用于二维码发布的已启用短链接，创建第一张二维码。") : text("This workspace does not have any QR codes yet.", "当前工作区还没有二维码。") } />}
    </section>
    {selected ? <QRDetail item={selected} workspaceId={workspace.id} canEdit={access.can_edit} onDelete={() => remove.mutate(selected.id)} /> : null}
  </Page>;
}
