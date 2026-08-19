import { Button, Field, Input } from "@gojet/ui";
import { useLocale } from "@gojet/ui/locale";
import { AuthShell, WebsiteShell } from "@gojet/ui/shells";

export function WebsiteShellPreview() {
  const { text } = useLocale();
  const websiteNav = [
    { label: text("Products", "产品"), href: "/products" },
    { label: text("Solutions", "解决方案"), href: "/solutions" },
    { label: text("Integrations", "集成"), href: "/developers" },
    { label: text("Pricing", "价格"), href: "/pricing" },
    { label: text("Docs", "文档"), href: "/docs/" },
  ];
  return <WebsiteShell nav={websiteNav} activeHref="/">
    <main className="shell-proof shell-proof-website">
      <p className="eyebrow">GOJET</p>
      <h1>{text("Create and manage what you share.", "创建并管理你对外分享的内容。")}</h1>
      <p>{text(
        "Use GoJet for short links, QR codes, file and text sharing, public profile pages, custom domains and visit reporting. Sign in to manage the actual content and settings in your workspace.",
        "使用 GoJet 创建短链接、二维码、文件与文本分享、公开个人主页，绑定自定义域名并查看访问数据。登录后可以在工作区中管理实际内容和设置。"
      )}</p>
      <div className="shell-proof-blocks" aria-hidden="true"><span /><span /><span /></div>
    </main>
  </WebsiteShell>;
}

export function LoginShellPreview() {
  const { text } = useLocale();
  return <AuthShell>
    <h1>{text("Sign in to GoJet", "登录 GoJet")}</h1>
    <p>{text("Enter the account email and password you use for your GoJet workspaces.", "输入你用于 GoJet 工作区的账号邮箱和密码。")}</p>
    <form className="shell-auth-form" onSubmit={(event) => event.preventDefault()}>
      <Field label={text("Email", "邮箱")} htmlFor="shell-login-email"><Input id="shell-login-email" type="email" autoComplete="email" placeholder="you@example.com" /></Field>
      <Field label={text("Password", "密码")} htmlFor="shell-login-password"><Input id="shell-login-password" type="password" autoComplete="current-password" /></Field>
      <Button type="submit">{text("Sign in", "登录")}</Button>
    </form>
  </AuthShell>;
}

export function RegisterShellPreview() {
  const { text } = useLocale();
  return <AuthShell visualTitle={text("Create an account and start with your own workspace.", "创建账号并从自己的工作区开始使用。")}>
    <h1>{text("Create your GoJet account", "创建 GoJet 账号")}</h1>
    <p>{text("Choose a display name, enter your email and create a password. You can invite other people after the account is ready.", "填写显示名称和邮箱并设置密码。账号创建完成后，可以再按需要邀请其他成员。")}</p>
    <form className="shell-auth-form" onSubmit={(event) => event.preventDefault()}>
      <Field label={text("Display name", "显示名称")} htmlFor="shell-register-name"><Input id="shell-register-name" autoComplete="name" /></Field>
      <Field label={text("Email", "邮箱")} htmlFor="shell-register-email"><Input id="shell-register-email" type="email" autoComplete="email" /></Field>
      <Field label={text("Password", "密码")} htmlFor="shell-register-password"><Input id="shell-register-password" type="password" autoComplete="new-password" /></Field>
      <Button type="submit">{text("Create account", "创建账号")}</Button>
    </form>
  </AuthShell>;
}
