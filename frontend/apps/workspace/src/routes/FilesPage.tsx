import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { ApiError, createFilesClient, resourceAccess, type FileShareRecord, type WorkspaceSummary } from "@gojet/api-client";
import { Alert, Button, Dialog, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner } from "@gojet/ui";
import { SideSheet } from "@gojet/ui/overlays";
import { errorMessage, formatDate, linksClient, normalizeWorkspaces, requestedWorkspaceId } from "../links/client";

const filesClient = createFilesClient(api);
const MAX_FILE_BYTES = 100 * 1024 * 1024;

type FileState = "processing" | "scanning" | "safe" | "review" | "blocked" | "failed";

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
  if (error.status === 403) return { title: "Permission denied", body: "当前成员角色没有执行该文件操作的权限。" };
  if (error.status === 429) return { title: "Rate limited", body: "文件请求过于频繁，请稍后再试。" };
  if (error.status === 402 || error.status === 409) return { title: "Quota exceeded", body: "当前工作区的文件存储或用量额度不足。" };
  if (error.status === 413) return { title: "File too large", body: "单文件必须大于 0 且不超过 100 MB。" };
  if (error.status === 503) return { title: "File service disabled", body: "文件服务当前不可用。GoJet 不会在浏览器中绕过扫描或发布门禁。" };
  return null;
}

function authoritativeFileState(item: FileShareRecord): FileState {
  if (item.scan_status === "clean" && item.status === "active") return "safe";
  if (item.scan_status === "infected") return "blocked";
  if (item.scan_status === "error") return "failed";
  if (item.scan_status === "scanning") return "scanning";
  if (item.scan_status === "pending" || item.status === "quarantined") return "processing";
  return "review";
}

function stateLabel(state: FileState) {
  return ({ processing: "Processing", scanning: "Scanning", safe: "Safe", review: "Review", blocked: "Blocked", failed: "Failed" } as const)[state];
}

function canPublish(item: FileShareRecord) {
  return item.scan_status === "clean" && item.status === "active";
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB"];
  let size = value;
  let index = -1;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function UploadFileForm({ workspaceId, canEdit }: { workspaceId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [clientError, setClientError] = useState("");

  const chooseFile = (next: File | null) => {
    setClientError("");
    if (next && next.size > MAX_FILE_BYTES) {
      setFile(null);
      setClientError("File too large · 单文件不能超过 100 MB。" );
      return;
    }
    if (next && next.size === 0) {
      setFile(null);
      setClientError("Empty files cannot be uploaded." );
      return;
    }
    setFile(next);
  };

  const upload = useMutation({
    mutationFn: () => filesClient.upload(workspaceId, {
      file: file!,
      ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
      ...(maxDownloads ? { max_downloads: Number(maxDownloads) } : {}),
      ...(password.trim() ? { password: password.trim() } : {})
    }),
    onSuccess: async () => {
      setFile(null);
      setExpiresAt("");
      setMaxDownloads("");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: ["file-shares", workspaceId] });
    }
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !file) return;
    if (password && (password.length < 6 || password.length > 128)) {
      setClientError("Password must contain 6 to 128 characters.");
      return;
    }
    upload.mutate();
  };
  const special = requestState(upload.error);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files.item(0));
  };

  return <form className="resource-create-form" onSubmit={submit} data-file-upload-form>
    {!canEdit ? <Alert tone="warning" title="Read-only">当前角色不能上传文件。</Alert> : null}
    {clientError ? <Alert tone="danger" title="Upload validation">{clientError}</Alert> : null}
    {special ? <Alert tone="danger" title={special.title}>{special.body}</Alert> : upload.isError ? <Alert tone="danger" title="Upload failed">{errorMessage(upload.error)}</Alert> : null}
    {upload.isPending ? <Alert tone="info" title="Uploading">文件正在上传；完成后仍只会进入隔离区，不代表已经安全。</Alert> : null}
    {upload.isSuccess ? <Alert tone="info" title="Processing">上传已由服务端接受并进入 quarantine / scan queue。只有 ClamAV 返回 clean 且服务端状态变为 active 后才会公开。</Alert> : null}

    <div
      className="file-dropzone"
      data-dragging={dragging || undefined}
      tabIndex={0}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onPaste={(event) => chooseFile(event.clipboardData.files.item(0))}
      aria-label="File dropzone"
    >
      <strong>{file ? file.name : "Drag, paste or browse a file"}</strong>
      <span>{file ? formatBytes(file.size) : "Drop a file here, paste a file from the clipboard, or choose one below."}</span>
      <input aria-label="Browse file" type="file" onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)} />
      <small>Maximum file size: 100 MB · one file per upload request.</small>
    </div>

    <Alert tone="warning" title="Security scan required">Upload success is not a safety decision. New files remain quarantined while the Go fileworker and ClamAV determine the authoritative publish state.</Alert>
    <Alert tone="info" title="Folder upload">Folder upload is not exposed because the current backend capability accepts one file per request. V5 does not simulate unsupported folder ingestion.</Alert>

    <div className="resource-form-grid">
      <Field label="Expires at" htmlFor="file-expiry" help="Optional. Public access stops after this time."><Input id="file-expiry" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
      <Field label="Max downloads" htmlFor="file-downloads" help="Optional. Must be at least 1."><Input id="file-downloads" type="number" min={1} step={1} value={maxDownloads} onChange={(event) => setMaxDownloads(event.target.value)} /></Field>
    </div>
    <Field label="Access password" htmlFor="file-password" help="Optional · 6–128 characters."><Input id="file-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
    <div className="resource-sheet-footer"><Button type="submit" loading={upload.isPending} disabled={!canEdit || !file}>Upload file</Button></div>
  </form>;
}

function FileRow({ item, workspaceId, canEdit, onDelete }: { item: FileShareRecord; workspaceId: number; canEdit: boolean; onDelete: () => void }) {
  const state = authoritativeFileState(item);
  const publishable = canPublish(item);
  const expiry = item.expires_at ? formatDate(item.expires_at) : "No expiry";
  return <article className="file-resource-row" data-file-state={state} data-file-id={item.id}>
    <span><strong>{item.original_name}</strong><small>{item.mime_type || "application/octet-stream"} · {item.protected ? "Password protected" : "Public after safe"}</small></span>
    <span><strong>{formatBytes(item.size_bytes)}</strong><small>size</small></span>
    <span><strong className="file-state"><i className="file-state-dot" aria-hidden="true" />{stateLabel(state)}</strong><small>{item.scan_status} / {item.status}</small></span>
    <span><strong>{item.downloads}{item.max_downloads ? ` / ${item.max_downloads}` : ""}</strong><small>downloads</small></span>
    <span><strong>{expiry}</strong><small>expiry</small></span>
    <span><strong>{formatDate(item.created_at)}</strong><small>created</small></span>
    <div className="file-row-actions">
      {publishable ? <a className="resource-download-link" href={filesClient.publicUrl(item.slug)}>Open share</a> : <span className="file-not-public">Not public</span>}
      {canEdit ? <Dialog triggerLabel="Delete" title="Delete file share?" description="Public access is removed immediately and the object moves to an isolated tombstone before scheduled purge." confirmLabel="Delete file" destructive onConfirm={onDelete}><p>The default recovery retention is 7 days; the file is not publicly accessible during that window.</p></Dialog> : null}
    </div>
  </article>;
}

export default function FilesPage() {
  const { workspaces, workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.id;
  const files = useQuery({ queryKey: ["file-shares", workspaceId], queryFn: () => filesClient.list(workspaceId!), enabled: Boolean(workspaceId), refetchInterval: 15_000 });
  const access = workspace ? resourceAccess(workspace.role) : null;
  const remove = useMutation({ mutationFn: (fileId: number) => filesClient.delete(workspaceId!, fileId), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["file-shares", workspaceId] }) });

  if (workspaces.isPending) return <Page className="resources-page"><div className="resources-centered"><Spinner label="正在读取工作区" /></div></Page>;
  if (workspaces.isError) return <Page className="resources-page"><ErrorState title="无法读取工作区" description={errorMessage(workspaces.error)} action={<Button type="button" onClick={() => workspaces.refetch()}>重试</Button>} /></Page>;
  if (!workspace || !access) return <Page className="resources-page"><EmptyState title="还没有工作区" description="创建工作区后才能管理文件分享。" /></Page>;

  const rows = files.data?.data ?? [];
  const stateCounts = useMemo(() => rows.reduce<Record<FileState, number>>((counts, item) => { counts[authoritativeFileState(item)] += 1; return counts; }, { processing: 0, scanning: 0, safe: 0, review: 0, blocked: 0, failed: 0 }), [rows]);
  const attention = stateCounts.review + stateCounts.blocked + stateCounts.failed;
  const listState = requestState(files.error);

  return <Page className="resources-page" data-p09-files>
    <PageHeader title="Files" description={`Secure file upload, quarantine, scanning and sharing · ${workspace.name}`} actions={access.can_edit ? <SideSheet triggerLabel="Upload file" title="Upload file" description="Files enter quarantine first. Public sharing stays disabled until the backend reports clean + active."><UploadFileForm workspaceId={workspace.id} canEdit={access.can_edit} /></SideSheet> : undefined} />
    {!access.can_edit ? <Alert tone="warning" title="Read-only file access">当前角色为 {workspace.role}。可以查看状态与安全的公开分享，但上传和删除由 RBAC 禁止。</Alert> : null}
    {attention > 0 ? <Alert tone="warning" title="Partial safety state">{attention} 个文件需要关注：Review / Blocked / Failed 状态不会生成公开入口。</Alert> : null}
    {remove.isError ? <Alert tone="danger" title="Delete failed">{errorMessage(remove.error)}</Alert> : null}

    <section className="resource-summary-grid" aria-label="File summary">
      <article><span>Files</span><strong>{rows.length}</strong><small>current workspace</small></article>
      <article><span>Safe & public</span><strong>{stateCounts.safe}</strong><small>clean + active only</small></article>
      <article><span>Scanning queue</span><strong>{stateCounts.processing + stateCounts.scanning}</strong><small>not public yet</small></article>
    </section>

    <section className="file-safety-panel" aria-label="File safety contract">
      <span className="resource-eyebrow">SERVER TRUTH</span><h2>Quarantine → ClamAV → publish</h2>
      <ul><li>Upload returns an accepted resource, not a browser safety verdict.</li><li>Pending/scanning files remain non-public.</li><li>Only <code>scan_status=clean</code> and <code>status=active</code> expose the public share link.</li><li>Infected/error/review states never receive a public action.</li></ul>
    </section>

    <section className="resource-section" aria-labelledby="files-list-title">
      <div className="resource-section-head"><div><span className="resource-eyebrow">SECURE SHARING</span><h2 id="files-list-title">File library</h2><p>File, size, status, downloads, expiry and created time are returned by the Go API.</p></div></div>
      {files.isPending ? <div className="resources-centered"><Spinner label="正在加载文件" /></div> : listState ? <ErrorState title={listState.title} description={listState.body} action={<Button type="button" onClick={() => files.refetch()}>重试</Button>} /> : files.isError ? <ErrorState title="无法加载文件" description={errorMessage(files.error)} action={<Button type="button" onClick={() => files.refetch()}>重试</Button>} /> : rows.length ? <div className="file-resource-list"><div className="file-resource-head" aria-hidden="true"><span>File</span><span>Size</span><span>Status</span><span>Downloads</span><span>Expiry</span><span>Created</span><span>Actions</span></div>{rows.map((item) => <FileRow key={item.id} item={item} workspaceId={workspace.id} canEdit={access.can_edit} onDelete={() => remove.mutate(item.id)} />)}</div> : <EmptyState title="No files" description={access.can_edit ? "Upload a file to begin. It will remain quarantined until the backend safety scan completes." : "当前工作区还没有文件。"} />}
    </section>
  </Page>;
}
