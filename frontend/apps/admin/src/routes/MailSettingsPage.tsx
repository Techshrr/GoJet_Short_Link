import { type FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, ErrorState, Field, Input, Page, PageHeader, Select, Spinner } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import { p14Client, p14Error, type MailConfig } from "../p14";
import "../p14.css";

const empty: MailConfig = { host: "", port: 587, username: "", encryption: "starttls", ehlo: "", from_email: "", from_name: "GoJet", reply_to: "", password_configured: false };

export default function MailSettingsPage() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["p14-mail-settings"], queryFn: p14Client.settings });
  const [form, setForm] = useState<MailConfig>(empty);
  const [password, setPassword] = useState("");
  const [testRecipient, setTestRecipient] = useState("");

  useEffect(() => { if (query.data?.mail) setForm(query.data.mail); }, [query.data]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        host: form.host, port: Number(form.port), username: form.username, encryption: form.encryption,
        ehlo: form.ehlo, from_email: form.from_email, from_name: form.from_name, reply_to: form.reply_to,
      };
      if (password.trim()) body.password = password;
      return p14Client.saveMail(body);
    },
    onSuccess: async () => { setPassword(""); await qc.invalidateQueries({ queryKey: ["p14-mail-settings"] }); },
  });
  const test = useMutation({ mutationFn: () => p14Client.testMail(testRecipient.trim()) });
  const set = (key: keyof MailConfig, value: string | number | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };

  return <Page className="p14-page" data-p14-mail-settings>
    <PageHeader
      title={text("Mail settings", "邮件设置")}
      description={text(
        "Configure the SMTP server used for account, billing, security and support mail. Existing passwords remain write-only and are never returned to the browser.",
        "配置用于账号、账单、安全通知和工单邮件的 SMTP 服务。已保存的密码只写不回显，不会返回到浏览器。"
      )}
    />
    {query.isPending ? <Spinner label={text("Loading mail settings", "正在读取邮件设置")} /> : query.isError ? <ErrorState title={text("Unable to load mail settings", "无法读取邮件设置")} description={p14Error(query.error)} /> : <div className="p14-split">
      <section className="p14-card">
        <h2>{text("SMTP server", "SMTP 服务器")}</h2>
        <p className="p14-muted">{text("Enter the connection and sender identity used by GoJet when sending mail.", "填写 GoJet 发信时使用的服务器连接信息和发件人身份。")}</p>
        <form className="p14-form" onSubmit={submit}>
          <Field label={text("Server address", "服务器地址")} htmlFor="mail-host"><Input id="mail-host" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.example.com" /></Field>
          <Field label={text("Port", "端口")} htmlFor="mail-port"><Input id="mail-port" type="number" min={1} max={65535} value={form.port} onChange={(e) => set("port", Number(e.target.value))} /></Field>
          <Field label={text("Connection security", "连接加密")} htmlFor="mail-encryption"><Select id="mail-encryption" value={form.encryption} onChange={(e) => set("encryption", e.target.value)}><option value="starttls">STARTTLS</option><option value="tls">TLS</option><option value="none">{text("None", "不加密")}</option></Select></Field>
          <Field label={text("Username", "用户名")} htmlFor="mail-username"><Input id="mail-username" value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" /></Field>
          <Field label={text("Password", "密码")} htmlFor="mail-password" help={form.password_configured ? text("A password is already configured. Leave this field blank to keep it unchanged.", "已有密码。此处留空即可保持原密码不变。") : text("No SMTP password is currently configured.", "当前尚未配置 SMTP 密码。") }><Input id="mail-password" type="password" autoComplete="new-password" value={password} placeholder={form.password_configured ? text("Configured — leave blank to preserve", "已配置 — 留空保持不变") : ""} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Field label="EHLO" htmlFor="mail-ehlo" help={text("Optional hostname presented to the SMTP server during the connection.", "可选。连接 SMTP 服务器时用于 EHLO 的主机名。") }><Input id="mail-ehlo" value={form.ehlo} onChange={(e) => set("ehlo", e.target.value)} /></Field>
          <Field label={text("From email", "发件邮箱")} htmlFor="mail-from-email"><Input id="mail-from-email" type="email" value={form.from_email} onChange={(e) => set("from_email", e.target.value)} /></Field>
          <Field label={text("From name", "发件人名称")} htmlFor="mail-from-name"><Input id="mail-from-name" value={form.from_name} onChange={(e) => set("from_name", e.target.value)} /></Field>
          <Field label={text("Reply-to email", "回复邮箱")} htmlFor="mail-reply-to"><Input id="mail-reply-to" type="email" value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} /></Field>
          {save.isError ? <Alert tone="danger" title={text("Mail settings were not saved", "邮件设置保存失败")}>{p14Error(save.error)}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Mail settings saved", "邮件设置已保存")}>{text("The SMTP password remains protected and is not returned to this page.", "SMTP 密码仍以受保护方式保存，不会在此页面回显。")}</Alert> : null}
          <Button type="submit" loading={save.isPending}>{text("Save mail settings", "保存邮件设置")}</Button>
        </form>
      </section>

      <section className="p14-card">
        <h2>{text("Send a test email", "发送测试邮件")}</h2>
        <p className="p14-muted">{text("Send one test message to verify the SMTP connection, encryption, authentication and message acceptance.", "发送一封测试邮件，用于验证 SMTP 连接、加密、身份认证和邮件提交是否正常。")}</p>
        <div className="p14-form">
          <Field label={text("Recipient", "收件邮箱")} htmlFor="mail-test-recipient"><Input id="mail-test-recipient" type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} /></Field>
          {test.isError ? <Alert tone="danger" title={text("Test email failed", "测试邮件发送失败")}>{p14Error(test.error)}</Alert> : test.isSuccess ? <Alert tone="info" title={text("Test email accepted", "测试邮件发送成功")}>{text("The SMTP server accepted the test message for delivery.", "SMTP 服务器已经接受这封测试邮件并进入投递流程。")}</Alert> : null}
          <Button type="button" loading={test.isPending} disabled={!testRecipient.includes("@")} onClick={() => test.mutate()}>{text("Send test email", "发送测试邮件")}</Button>
        </div>
      </section>
    </div>}
  </Page>;
}
