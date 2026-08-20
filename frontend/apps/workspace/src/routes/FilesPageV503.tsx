import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createFilesClient, resourceAccess, type FileShareRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner, useLocale } from "@gojet/ui";
import { AlertDialog, SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const filesClient = createFilesClient(api);
const MAX_FILE_BYTES = 100 * 1024 * 1024;
type Copy = (en: string, zh: string) => string;
type FileState = "processing" | "safe" | "review" | "blocked" | "failed";
type RequestMessage = [title: string, description: string];

function useWorkspace() {
  const workspaces = useQuery({ queryKey: ["workspaces"], queryFn: async () => normalizeWorkspaces((await linksClient.workspaces()) as { data: WorkspaceSummary[] } | WorkspaceSummary[]) });
  const requested = requestedWorkspaceId();
  return { workspaces, workspace: workspaces.data?.find((item) => item.id === requested) ?? workspaces.data?.[0] };
}
function state(item: FileShareRecord): FileState {
  if (item.scan_status === "clean" && item.status === "active") return "safe";
  if (["infected", "blocked"].includes(item.scan_status) || item.status === "blocked") return "blocked";
  if (["error", "failed"].includes(item.scan_status) || item.status === "failed") return "failed";
  if (["review", "manual_review"].includes(item.scan_status)) return "review";
  return "processing";
}
function requestMessage(error: unknown, c: Copy): RequestMessage | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 403) return [c("Permission denied", "没有操作权限"), c("Your current workspace role cannot perform this file action.", "你当前的工作区角色无权执行该文件操作。")];
  if (error.status === 429) return [c("Too many requests", "操作过于频繁"), c("Wait a moment and try again.", "请求过于频繁，请稍后再试。")];
  if (error.status === 402 || error.status === 409) return [c("Storage allowance reached", "文件额度不足"), c("This workspace has reached its current file storage or usage allowance.", "当前工作区的文件存储或使用额度不足。")];
  if (error.status === 413) return [c("File too large", "文件过大"), c("Each file must be larger than 0 bytes and no larger than 100 MB.", "单个文件必须大于 0 字节且不超过 100 MB。")];
  if (error.status === 503) return [c("File service unavailable", "文件服务暂时不可用"), c("The file service cannot complete this request right now. Safety checks will not be bypassed.", "文件服务当前无法完成请求，系统不会绕过安全检查直接发布文件。")];
  return null;
}
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB`; }

function UploadForm({ workspaceId, onDone, c }: { workspaceId: number; onDone: () => void; c: Copy }) {
  const [file, setFile] = useState<File | null>(null); const [expiresAt, setExpiresAt] = useState(""); const [maxDownloads, setMaxDownloads] = useState(""); const [password, setPassword] = useState("");
  const mutation = useMutation({ mutationFn: () => filesClient.upload(workspaceId, { file: file!, ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}), ...(maxDownloads ? { max_downloads: Number(maxDownloads) } : {}), ...(password ? { password } : {}) }), onSuccess: onDone });
  const message = requestMessage(mutation.error, c);
  const submit = (event: FormEvent) => { event.preventDefault(); if (file && file.size > 0 && file.size <= MAX_FILE_BYTES) mutation.mutate(); };
  return <form className="files-upload-form" onSubmit={submit}>
    {message ? <Alert tone="danger" title={message[0]}>{message[1]}</Alert> : mutation.isError ? <Alert tone="danger" title={c("Upload failed", "上传失败")}>{errorMessage(mutation.error)}</Alert> : null}
    <Field label={c("File", "文件")} htmlFor="file-upload" required help={c("Maximum file size: 100 MB. The file must pass the configured safety scan before it becomes downloadable.", "单文件最大 100 MB。文件必须通过已配置的安全扫描后才会进入可下载状态。")}> <Input id="file-upload" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></Field>
    {file ? <p className="links-muted">{file.name} · {formatBytes(file.size)}</p> : null}
    <div className="links-form-grid"><Field label={c("Expiration", "有效期")} htmlFor="file-expiry"><Input id="file-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)}/></Field><Field label={c("Download limit", "下载次数上限")} htmlFor="file-download-limit"><Input id="file-download-limit" type="number" min={1} value={maxDownloads} onChange={(event) => setMaxDownloads(event.target.value)} placeholder={c("Unlimited", "不限制")}/></Field></div>
    <Field label={c("Access password", "访问密码")} htmlFor="file-password" help={c("Optional. Use at least 6 characters when enabled.", "可选；启用时请至少设置 6 位密码。")}> <Input id="file-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password"/></Field>
    <Button type="submit" loading={mutation.isPending} disabled={!file || file.size <= 0 || file.size > MAX_FILE_BYTES}>{c("Upload file", "上传文件")}</Button>
  </form>;
}

export default function FilesPageV503() {
  const { locale } = useLocale(); const c: Copy = (en, cn) => locale === "zh-CN" ? cn : en; const { workspaces, workspace } = useWorkspace(); const queryClient = useQueryClient(); const workspaceId = workspace?.id;
  const list = useQuery({ queryKey: ["files", workspaceId], queryFn: () => filesClient.list(workspaceId!), enabled: Boolean(workspaceId), refetchInterval: 15_000 });
  const remove = useMutation({ mutationFn: (id: number) => filesClient.delete(workspaceId!, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files", workspaceId] }) });
  if (workspaces.isPending) return <Page className="files-page"><div className="workspace-centered"><Spinner label={c("Loading workspace", "正在读取工作区")}/></div></Page>;
  if (workspaces.isError) return <Page className="files-page"><ErrorState title={c("Unable to load workspace", "无法读取工作区")} description={errorMessage(workspaces.error)}/></Page>;
  if (!workspace) return <Page className="files-page"><EmptyState title={c("No workspace", "还没有工作区")} description={c("Create or join a workspace before sharing files.", "创建或加入工作区后才能分享文件。")}/></Page>;
  const access = resourceAccess(workspace.role); const items = list.data?.data ?? [];
  const stateLabel = (value: FileState) => ({ processing: c("Safety check in progress", "安全检查中"), safe: c("Ready", "可以下载"), review: c("Needs review", "等待复核"), blocked: c("Blocked", "已阻止"), failed: c("Check failed", "检查失败") } as Record<FileState,string>)[value];
  const stateTone = (value: FileState): "success"|"warning"|"danger"|"neutral" => value === "safe" ? "success" : value === "processing" || value === "review" ? "warning" : "danger";
  return <Page className="files-page" data-v503-files>
    <PageHeader title={c("Files", "文件")} description={c(`Upload and manage file shares in ${workspace.name}. Files become downloadable only after the required safety check succeeds.`, `在 ${workspace.name} 中上传和管理文件分享。只有完成必要的安全检查后，文件才会进入可下载状态。`)} actions={access.can_edit ? <SideSheet triggerLabel={c("Upload file", "上传文件")} title={c("Upload file", "上传文件")} description={c("Choose the file and optional access limits. GoJet will keep it unavailable until the safety check is complete.", "选择文件并按需要设置访问限制。安全检查完成前，GoJet 会保持文件不可下载。")}> <UploadForm workspaceId={workspace.id} onDone={() => queryClient.invalidateQueries({ queryKey: ["files", workspace.id] })} c={c}/></SideSheet> : undefined}/>
    {!access.can_edit ? <Alert tone="warning" title={c("Read-only files", "文件只读")}>{c("Your current workspace role can view file shares but cannot upload or delete them.", "你当前的工作区角色可以查看文件分享，但不能上传或删除文件。")}</Alert> : null}
    {remove.isError ? <Alert tone="danger" title={c("Delete failed", "删除失败")}>{errorMessage(remove.error)}</Alert> : null}
    {list.isPending ? <div className="workspace-centered"><Spinner label={c("Loading files", "正在加载文件")}/></div> : list.isError ? <ErrorState title={c("Unable to load files", "无法加载文件")} description={errorMessage(list.error)} action={<Button onClick={() => list.refetch()}>{c("Retry", "重试")}</Button>}/> : items.length ? <div className="workspace-table-wrap"><table className="workspace-table"><thead><tr><th>{c("File", "文件")}</th><th>{c("Size", "大小")}</th><th>{c("Safety status", "安全状态")}</th><th>{c("Downloads", "下载次数")}</th><th>{c("Access", "访问限制")}</th><th>{c("Created", "创建时间")}</th><th>{c("Actions", "操作")}</th></tr></thead><tbody>{items.map((item) => { const current = state(item); const ready = current === "safe"; return <tr key={item.id}><td><strong>{item.original_name}</strong><small>{item.mime_type}</small></td><td>{formatBytes(item.size_bytes)}</td><td><Badge tone={stateTone(current)}>{stateLabel(current)}</Badge></td><td>{item.downloads}{item.max_downloads ? ` / ${item.max_downloads}` : ""}</td><td>{[item.protected ? c("Password", "密码") : "", item.expires_at ? c("Expires", "有有效期") : ""].filter(Boolean).join(" · ") || c("Open", "公开")}</td><td>{formatDate(item.created_at)}</td><td><div className="workspace-card-actions">{ready ? <a className="gj-button" data-variant="outline" data-size="sm" href={filesClient.publicUrl(item.slug)} target="_blank" rel="noreferrer">{c("Open", "打开")}</a> : <Button size="sm" variant="outline" type="button" disabled>{c("Not ready", "暂不可用")}</Button>}{access.can_edit ? <AlertDialog triggerLabel={c("Delete", "删除")} title={c("Delete this file share?", "删除这个文件分享？")} description={c("The public file URL will stop working after deletion.", "删除后，这个公开文件地址将停止访问。") } confirmLabel={c("Delete file", "确认删除")} onConfirm={() => remove.mutate(item.id)}/> : null}</div></td></tr>; })}</tbody></table></div> : <EmptyState title={c("No files", "还没有文件")} description={c("Upload a file when you need a managed download link.", "需要可管理的下载链接时，可以上传第一个文件。")}/>} 
  </Page>;
}
