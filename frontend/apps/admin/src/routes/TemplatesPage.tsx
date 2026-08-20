import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, EmptyState, ErrorState, Field, Input, Page, PageHeader, Spinner, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import { p14Client, p14Date, p14Error, type MailTemplate } from "../p14";
import "../p14.css";

export default function TemplatesPage() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["p14-mail-templates"], queryFn: p14Client.templates });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<MailTemplate | null>(null);
  const items = list.data?.data ?? [];

  useEffect(() => {
    const next = items.find((item) => item.key === (selected ?? items[0]?.key));
    if (next) { setSelected(next.key); setDraft(next); }
  }, [list.data, selected]);

  const save = useMutation({
    mutationFn: () => p14Client.saveTemplate(draft!),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["p14-mail-templates"] }); },
  });
  const statusLabel = (status: string) => status === "active" ? text("Active", "正常") : status === "disabled" ? text("Disabled", "已停用") : status;

  return <Page className="p14-page" data-p14-mail-templates>
    <PageHeader
      title={text("Mail templates", "消息模板")}
      description={text(
        "Edit the subject and message body used for newly queued mail. The shared GoJet mail layout, logo and footer are applied automatically.",
        "编辑新发送邮件使用的主题和正文内容。GoJet 的统一邮件版式、Logo 和页脚会由系统自动套用。"
      )}
    />
    <div className="p14-split">
      <section className="p14-card">
        <h2>{text("Template library", "模板列表")}</h2>
        {list.isPending ? <Spinner label={text("Loading templates", "正在加载模板")} /> : list.isError ? <ErrorState title={text("Unable to load templates", "无法加载模板")} description={p14Error(list.error)} /> : items.length ? <div className="p14-list">
          {items.map((item) => <button type="button" key={item.key} className={selected === item.key ? "p14-row is-active" : "p14-row"} onClick={() => { setSelected(item.key); setDraft(item); }}>
            <span><strong>{item.name}</strong><small>{item.key}</small></span>
            <Badge tone={item.status === "active" ? "success" : "neutral"}>{statusLabel(item.status)}</Badge>
            <small>{text("Updated", "更新时间")} {p14Date(item.updated_at)}</small>
          </button>)}
        </div> : <EmptyState title={text("No templates", "暂无模板")} description={text("No mail templates are registered on the server.", "服务器当前没有已登记的邮件模板。")}/>} 
      </section>

      <section className="p14-card">
        <h2>{text("Template editor", "模板编辑")}</h2>
        {draft ? <div className="p14-form">
          <Field label={text("Template name", "模板名称")} htmlFor="template-name"><Input id="template-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label={text("Email subject", "邮件主题")} htmlFor="template-subject"><Input id="template-subject" value={draft.subject_template} onChange={(e) => setDraft({ ...draft, subject_template: e.target.value })} /></Field>
          <Field
            label={text("Message body (HTML fragment)", "邮件正文（HTML 片段）")}
            htmlFor="template-html"
            help={text("Edit only the message content. Do not add <html>, <head> or <body>; the shared branded layout is generated automatically.", "这里只编辑邮件正文内容，不要加入 <html>、<head> 或 <body>；统一品牌版式会由系统自动生成。")}
          >
            <Textarea id="template-html" rows={16} value={draft.html_template} onChange={(e) => setDraft({ ...draft, html_template: e.target.value })} />
          </Field>
          {save.isError ? <Alert tone="danger" title={text("Template was not saved", "模板保存失败")}>{p14Error(save.error)}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Template saved", "模板已保存")}>{text("Newly queued mail will use the updated subject and message body.", "之后新进入发送队列的邮件会使用最新主题和正文。")}</Alert> : null}
          <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>{text("Save template", "保存模板")}</Button>
        </div> : <EmptyState title={text("Select a template", "请选择模板")} description={text("Choose a template from the list to edit it.", "从左侧模板列表中选择一项后即可编辑。")}/>} 
      </section>
    </div>
  </Page>;
}
