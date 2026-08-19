import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@gojet/ui/shells";
import { localizedError, useLocale } from "@gojet/ui/locale";
import TurnstileField from "../TurnstileField";
import "../auth.css";

type AbuseResponse = { reference?: number | string };

export default function ReportAbusePage() {
  const { locale, text } = useLocale();
  const params = new URLSearchParams(location.search);
  const legalPrefix = locale === "zh-CN" ? "/zh-CN" : "";
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { document.title = text("Report abuse — GoJet", "举报滥用 — GoJet"); }, [text]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/public/abuse-reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url: url.trim(), reason, reporter_email: email.trim(), details: details.trim(), turnstile_token: turnstileToken })
      });
      const data = await response.json().catch(() => ({})) as AbuseResponse & { error?: string };
      if (!response.ok) throw Object.assign(new Error(data.error || ""), { status: response.status });
      setUrl(""); setReason(""); setEmail(""); setDetails(""); setTurnstileToken("");
      const reference = data.reference ? ` #${data.reference}` : "";
      setSuccess(text(`Your report has been submitted${reference}. The safety team will review the URL and the information you provided.`, `举报已提交${reference}。安全团队会审核相关地址以及你提供的信息。`));
    } catch (cause) {
      const status = typeof cause === "object" && cause && "status" in cause ? Number((cause as { status?: number }).status) : undefined;
      const message = cause instanceof Error ? cause.message : undefined;
      setError(localizedError(message, locale, status));
    } finally { setBusy(false); }
  }

  return <AuthShell
    visualTitle={text("Help keep harmful links and public content off GoJet.", "帮助 GoJet 及时处理有害链接和公开内容。")}
    visualBody={text("Report phishing, malware, fraud, spam, rights infringement or other prohibited use. The report is reviewed against the Terms of Service and Acceptable Use Policy.", "可以举报钓鱼、恶意软件、欺诈、垃圾信息、侵权或其他禁止行为。举报会按照《服务条款》和《可接受使用政策》进行审核。")}
  >
    <form className="auth-card abuse-report-form" onSubmit={submit} data-abuse-report-form>
      <div><h1>{text("Report abuse", "举报滥用")}</h1><p className="auth-subtitle">{text("Provide the exact GoJet address and enough context for the safety team to review the report. Your contact email is optional and is used only if more information is needed.", "请提供准确的 GoJet 地址以及足够的背景信息，便于安全团队审核。联系邮箱为可选项，仅在需要补充信息时用于联系你。")}</p></div>
      <label>{text("GoJet URL being reported", "被举报的 GoJet 地址")}<input type="url" required maxLength={2048} autoComplete="url" placeholder="https://gojet.cc/example" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
      <label>{text("Reason for report", "举报原因")}<select required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">{text("Choose a reason", "请选择举报原因")}</option><option value="malware">{text("Malware or harmful download", "恶意软件或有害下载")}</option><option value="phishing">{text("Phishing or credential theft", "网络钓鱼或凭据窃取")}</option><option value="spam">{text("Spam or deceptive promotion", "垃圾信息或欺骗性推广")}</option><option value="copyright">{text("Copyright or other rights infringement", "版权或其他权利侵害")}</option><option value="other">{text("Other prohibited use", "其他禁止行为")}</option></select></label>
      <label>{text("Contact email (optional)", "联系邮箱（可选）")}<input type="email" maxLength={320} autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>{text("Additional details (optional)", "补充说明（可选）")}<textarea rows={7} maxLength={5000} placeholder={text("Describe what you observed and include only information needed to review the report.", "请说明发现的问题，并只提供审核举报所需的信息。") } value={details} onChange={(event) => setDetails(event.target.value)} /></label>
      <TurnstileField surface="abuse" onToken={setTurnstileToken} />
      {error ? <div className="auth-alert is-error" role="alert">{error}</div> : null}
      {success ? <div className="auth-alert is-success" role="status">{success}</div> : null}
      <button className="auth-submit" disabled={busy}>{busy ? text("Submitting…", "提交中…") : text("Submit report", "提交举报")}</button>
      <div className="auth-legal-links"><a href={`${legalPrefix}/legal/terms/`}>{text("Terms of Service", "服务条款")}</a><a href={`${legalPrefix}/legal/acceptable-use/`}>{text("Acceptable Use Policy", "可接受使用政策")}</a><a href={`${legalPrefix}/legal/privacy/`}>{text("Privacy Policy", "隐私政策")}</a></div>
    </form>
  </AuthShell>;
}
