import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Badge, Button, Checkbox, EmptyState, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";

type Item = {
  id?: string;
  enabled: boolean;
  title: string;
  message: string;
  link_text?: string;
  link_url?: string;
  tone?: string;
  dismissible: boolean;
  starts_at?: string;
  ends_at?: string;
  sort_order: number;
};
type Settings = { announcementbar?: Record<string, unknown> };

const blank = (sortOrder: number): Item => ({ enabled: true, title: "", message: "", link_text: "", link_url: "", tone: "info", dismissible: true, starts_at: "", ends_at: "", sort_order: sortOrder });
const toLocal = (value?: string) => value ? new Date(value).toISOString().slice(0, 16) : "";
const toServer = (value: string) => value ? new Date(value).toISOString() : "";

export default function AnnouncementsPageV503() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "v503", "announcements"], queryFn: () => api.get<Settings>("/api/admin/settings") });
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [rotation, setRotation] = useState(8);

  useEffect(() => {
    const section = query.data?.announcementbar;
    if (!section) return;
    setEnabled(section["announcementbar.enabled"] === true);
    setRotation(Number(section["announcementbar.rotation_seconds"] ?? 8));
    const stored = Array.isArray(section["announcementbar.items"]) ? section["announcementbar.items"] as Item[] : [];
    setItems(stored);
    setSelected((current) => current !== null && current < stored.length ? current : stored.length ? 0 : null);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (nextItems: Item[]) => api.put("/api/admin/settings/announcementbar", {
      "announcementbar.enabled": enabled,
      "announcementbar.rotation_seconds": rotation,
      "announcementbar.items": nextItems.map((item, index) => ({ ...item, starts_at: item.starts_at ? toServer(item.starts_at) : "", ends_at: item.ends_at ? toServer(item.ends_at) : "", sort_order: index })),
    }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "v503", "announcements"] }); },
  });

  const draft = selected === null ? null : items[selected];
  const updateDraft = <K extends keyof Item>(key: K, value: Item[K]) => setItems((current) => current.map((item, index) => index === selected ? { ...item, [key]: value } : item));
  const create = () => { const next = [...items, blank(items.length)]; setItems(next); setSelected(next.length - 1); };
  const remove = () => {
    if (selected === null) return;
    const next = items.filter((_, index) => index !== selected);
    setItems(next);
    setSelected(next.length ? Math.min(selected, next.length - 1) : null);
    save.mutate(next);
  };
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");

  return <Page data-p17-admin="announcements-v503">
    <PageHeader title={text("Announcements", "公告")} description={text("Create, edit, schedule, enable or remove public site announcements.", "创建、编辑、定时、启用或删除网站公告。") } actions={<Button type="button" onClick={create}>{text("New announcement", "新建公告")}</Button>} />
    {query.isPending ? <Spinner label={text("Loading announcements", "正在加载公告")} /> : query.isError ? <ErrorState title={text("Unable to load announcements", "无法加载公告")} description={query.error instanceof Error ? query.error.message : fallback} /> : <>
      <section className="p17-action-card">
        <h2>{text("Announcement bar", "公告栏设置")}</h2>
        <Checkbox label={text("Show announcement bar", "启用网站公告栏")} checked={enabled} onCheckedChange={setEnabled} />
        <Field label={text("Rotation interval (seconds)", "多条公告轮换间隔（秒）")} htmlFor="announcement-rotation"><Input id="announcement-rotation" type="number" min={4} max={60} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></Field>
      </section>

      <div className="p17-two-column">
        <section className="p17-action-card">
          <h2>{text("Announcement list", "公告列表")}</h2>
          {items.length ? <div className="p14-list">{items.map((item, index) => <button key={item.id ?? index} type="button" className={selected === index ? "p14-row is-active" : "p14-row"} onClick={() => setSelected(index)}><span><strong>{item.title || text("Untitled announcement", "未命名公告")}</strong><small>{item.message || text("No content yet", "尚未填写内容")}</small></span><Badge tone={item.enabled ? "success" : "neutral"}>{item.enabled ? text("Enabled", "已启用") : text("Disabled", "已停用")}</Badge></button>)}</div> : <EmptyState title={text("No announcements", "暂无公告")} description={text("Create an announcement when you need to publish a site-wide notice.", "需要发布站点通知时，可以在这里新建公告。")}/>} 
        </section>

        <section className="p17-action-card">
          <h2>{text("Announcement editor", "公告编辑")}</h2>
          {draft ? <div className="p14-form">
            <Checkbox label={text("Enable this announcement", "启用此公告")} checked={draft.enabled} onCheckedChange={(value) => updateDraft("enabled", value)} />
            <Field label={text("Title", "标题")} htmlFor="announcement-title"><Input id="announcement-title" value={draft.title} maxLength={80} onChange={(event) => updateDraft("title", event.target.value)} /></Field>
            <Field label={text("Content", "内容")} htmlFor="announcement-message"><Textarea id="announcement-message" rows={5} value={draft.message} maxLength={500} onChange={(event) => updateDraft("message", event.target.value)} /></Field>
            <div className="p17-form-grid">
              <Field label={text("Style", "显示样式")} htmlFor="announcement-tone"><Select id="announcement-tone" value={draft.tone ?? "info"} onChange={(event) => updateDraft("tone", event.target.value)}><option value="info">{text("Information", "信息")}</option><option value="success">{text("Success", "成功")}</option><option value="warning">{text("Warning", "提醒")}</option><option value="danger">{text("Important", "重要")}</option></Select></Field>
              <Checkbox label={text("Allow visitors to dismiss", "允许访客关闭")} checked={draft.dismissible} onCheckedChange={(value) => updateDraft("dismissible", value)} />
            </div>
            <div className="p17-form-grid">
              <Field label={text("Start time", "生效时间")} htmlFor="announcement-start"><Input id="announcement-start" type="datetime-local" value={toLocal(draft.starts_at)} onChange={(event) => updateDraft("starts_at", event.target.value)} /></Field>
              <Field label={text("End time", "结束时间")} htmlFor="announcement-end"><Input id="announcement-end" type="datetime-local" value={toLocal(draft.ends_at)} onChange={(event) => updateDraft("ends_at", event.target.value)} /></Field>
            </div>
            <div className="p17-form-grid">
              <Field label={text("Link text", "链接文字")} htmlFor="announcement-link-text"><Input id="announcement-link-text" value={draft.link_text ?? ""} maxLength={40} onChange={(event) => updateDraft("link_text", event.target.value)} /></Field>
              <Field label={text("Link URL", "链接地址")} htmlFor="announcement-link-url"><Input id="announcement-link-url" value={draft.link_url ?? ""} maxLength={2048} onChange={(event) => updateDraft("link_url", event.target.value)} /></Field>
            </div>
            {save.isError ? <Alert tone="danger" title={text("Announcement was not saved", "公告保存失败")}>{save.error instanceof Error ? save.error.message : fallback}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Announcement saved", "公告已保存")}>{text("The public announcement bar will use the updated content and schedule.", "网站公告栏会按照最新内容和生效时间展示。")}</Alert> : null}
            <div className="p17-actions"><Button type="button" loading={save.isPending} disabled={draft.title.trim().length < 1 || draft.message.trim().length < 1} onClick={() => save.mutate(items)}>{text("Save announcement", "保存公告")}</Button><Button type="button" variant="destructive" disabled={save.isPending} onClick={remove}>{text("Delete announcement", "删除公告")}</Button></div>
          </div> : <EmptyState title={text("Select an announcement", "请选择公告")} description={text("Choose an existing announcement or create a new one.", "选择已有公告，或新建一条公告。")}/>} 
        </section>
      </div>
    </>}
  </Page>;
}
