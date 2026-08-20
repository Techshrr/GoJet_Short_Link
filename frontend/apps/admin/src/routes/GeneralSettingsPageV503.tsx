import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@gojet/auth";
import { Alert, Button, ErrorState, Field, Input, Page, PageHeader, Select, Spinner, Textarea } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";

type Settings = { basic?: Record<string, unknown>; brand?: Record<string, unknown> };
type BasicKey = "site.name" | "site.short_name" | "site.tagline" | "site.description" | "site.language" | "site.timezone" | "site.contact_email" | "site.support_email" | "site.company_name" | "site.company_address" | "site.copyright";

const basicKeys: BasicKey[] = ["site.name", "site.short_name", "site.tagline", "site.description", "site.language", "site.timezone", "site.contact_email", "site.support_email", "site.company_name", "site.company_address", "site.copyright"];
const value = (input: unknown) => input == null ? "" : String(input);
const primaryColorExample = "#" + "2563eb";

export default function GeneralSettingsPageV503() {
  const { text } = useLocale();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "v503", "general-settings"], queryFn: () => api.get<Settings>("/api/admin/settings") });
  const [form, setForm] = useState<Record<BasicKey, string>>(() => Object.fromEntries(basicKeys.map((key) => [key, ""])) as Record<BasicKey, string>);
  const [primaryColor, setPrimaryColor] = useState("");

  useEffect(() => {
    if (!query.data) return;
    const basic = query.data.basic ?? {};
    setForm(Object.fromEntries(basicKeys.map((key) => [key, value(basic[key])])) as Record<BasicKey, string>);
    setPrimaryColor(value(query.data.brand?.["brand.primary_color"]));
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put("/api/admin/settings/basic", form);
      if (primaryColor.trim()) await api.put("/api/admin/settings/brand", { "brand.primary_color": primaryColor.trim() });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "v503", "general-settings"] }); },
  });
  const upload = useMutation({
    mutationFn: async ({ asset, file }: { asset: "logo" | "favicon"; file: File }) => {
      const data = new FormData(); data.append("file", file);
      return api.request<{ url: string }>(`/api/admin/brand/${asset}`, { method: "POST", body: data });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "v503", "general-settings"] }); },
  });
  const remove = useMutation({
    mutationFn: (asset: "logo" | "favicon") => api.delete(`/api/admin/brand/${asset}`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["admin", "v503", "general-settings"] }); },
  });

  const set = (key: BasicKey, next: string) => setForm((current) => ({ ...current, [key]: next }));
  const selectFile = (asset: "logo" | "favicon") => (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) upload.mutate({ asset, file }); event.target.value = ""; };
  const brand = query.data?.brand ?? {};
  const logo = value(brand.logo);
  const favicon = value(brand.favicon);
  const fallback = text("Request failed. Please try again.", "请求失败，请稍后重试。");

  return <Page data-p17-admin="general-v503">
    <PageHeader title={text("General settings", "基本设置")} description={text("Manage the site identity, company information, support contacts and brand images used by GoJet.", "管理 GoJet 的站点名称、公司信息、联系邮箱以及网站 Logo 和图标。")}/>
    {query.isPending ? <Spinner label={text("Loading settings", "正在读取设置")} /> : query.isError ? <ErrorState title={text("Unable to load settings", "无法读取设置")} description={query.error instanceof Error ? query.error.message : fallback} /> : <>
      <section className="p17-action-card">
        <h2>{text("Site identity", "站点信息")}</h2>
        <div className="p17-form-grid">
          <Field label={text("Site name", "站点名称")} htmlFor="site-name"><Input id="site-name" value={form["site.name"]} onChange={(e) => set("site.name", e.target.value)} /></Field>
          <Field label={text("Short name", "站点简称")} htmlFor="site-short-name"><Input id="site-short-name" value={form["site.short_name"]} onChange={(e) => set("site.short_name", e.target.value)} /></Field>
          <Field label={text("Default language", "默认语言")} htmlFor="site-language"><Select id="site-language" value={form["site.language"] || "zh-CN"} onChange={(e) => set("site.language", e.target.value)}><option value="zh-CN">简体中文</option><option value="en">English</option></Select></Field>
          <Field label={text("Timezone", "时区")} htmlFor="site-timezone"><Input id="site-timezone" value={form["site.timezone"]} onChange={(e) => set("site.timezone", e.target.value)} placeholder="Asia/Singapore" /></Field>
        </div>
        <Field label={text("Tagline", "站点标语")} htmlFor="site-tagline"><Input id="site-tagline" value={form["site.tagline"]} onChange={(e) => set("site.tagline", e.target.value)} /></Field>
        <Field label={text("Site description", "站点描述")} htmlFor="site-description"><Textarea id="site-description" rows={4} value={form["site.description"]} onChange={(e) => set("site.description", e.target.value)} /></Field>
      </section>

      <section className="p17-action-card">
        <h2>{text("Contact and company", "联系与公司信息")}</h2>
        <div className="p17-form-grid">
          <Field label={text("Contact email", "联系邮箱")} htmlFor="site-contact-email"><Input id="site-contact-email" type="email" value={form["site.contact_email"]} onChange={(e) => set("site.contact_email", e.target.value)} /></Field>
          <Field label={text("Support email", "客服邮箱")} htmlFor="site-support-email"><Input id="site-support-email" type="email" value={form["site.support_email"]} onChange={(e) => set("site.support_email", e.target.value)} /></Field>
          <Field label={text("Company name", "公司名称")} htmlFor="site-company"><Input id="site-company" value={form["site.company_name"]} onChange={(e) => set("site.company_name", e.target.value)} /></Field>
          <Field label={text("Copyright text", "版权文字")} htmlFor="site-copyright"><Input id="site-copyright" value={form["site.copyright"]} onChange={(e) => set("site.copyright", e.target.value)} /></Field>
        </div>
        <Field label={text("Company address", "公司地址")} htmlFor="site-company-address"><Textarea id="site-company-address" rows={3} value={form["site.company_address"]} onChange={(e) => set("site.company_address", e.target.value)} /></Field>
      </section>

      <section className="p17-action-card">
        <h2>{text("Brand assets", "品牌图片")}</h2>
        <p>{text("Upload the logo and browser icon used by the site. Files are validated by the server and stored as managed brand assets.", "上传网站使用的 Logo 和浏览器图标。文件会经过服务器校验并作为受管理的品牌资源保存。")}</p>
        <div className="p17-two-column">
          <div className="p17-brand-asset"><strong>{text("Logo", "网站 Logo")}</strong>{logo ? <img src={logo} alt={text("Current logo", "当前 Logo")} className="p17-brand-preview" /> : <span>{text("No logo uploaded", "尚未上传 Logo")}</span>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={selectFile("logo")} />{logo ? <Button type="button" variant="outline" onClick={() => remove.mutate("logo")}>{text("Remove logo", "删除 Logo")}</Button> : null}</div>
          <div className="p17-brand-asset"><strong>{text("Favicon", "网站图标")}</strong>{favicon ? <img src={favicon} alt={text("Current favicon", "当前网站图标")} className="p17-brand-preview p17-brand-preview-small" /> : <span>{text("No favicon uploaded", "尚未上传网站图标")}</span>}<input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/webp" onChange={selectFile("favicon")} />{favicon ? <Button type="button" variant="outline" onClick={() => remove.mutate("favicon")}>{text("Remove favicon", "删除网站图标")}</Button> : null}</div>
        </div>
        <Field label={text("Primary brand color", "品牌主色")} htmlFor="brand-primary-color"><Input id="brand-primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder={primaryColorExample} /></Field>
        {upload.isError || remove.isError ? <Alert tone="danger" title={text("Brand asset action failed", "品牌图片操作失败")}>{(upload.error || remove.error) instanceof Error ? (upload.error || remove.error as Error).message : fallback}</Alert> : null}
      </section>

      {save.isError ? <Alert tone="danger" title={text("Settings were not saved", "设置保存失败")}>{save.error instanceof Error ? save.error.message : fallback}</Alert> : save.isSuccess ? <Alert tone="info" title={text("Settings saved", "设置已保存")}>{text("The updated site identity is now stored on the server.", "最新站点信息已经保存到服务器。")}</Alert> : null}
      <Button type="button" loading={save.isPending} onClick={() => save.mutate()}>{text("Save settings", "保存设置")}</Button>
    </>}
  </Page>;
}
