import { Button, Field, Input } from "@gojet/ui";
import { AuthShell, WebsiteShell } from "@gojet/ui/shells";

const websiteNav = [
  { label: "Products", href: "/products" },
  { label: "Solutions", href: "/solutions" },
  { label: "Developers", href: "/developers" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs/" },
];

export function WebsiteShellPreview() {
  return (
    <WebsiteShell nav={websiteNav} activeHref="/">
      <main className="shell-proof shell-proof-website">
        <p className="eyebrow">GOJET V5 · P04</p>
        <h1>Website shell</h1>
        <p>This is the structural P04 shell gate. P19 owns the final marketing homepage and real product UI composition.</p>
        <div className="shell-proof-blocks" aria-hidden="true"><span /><span /><span /></div>
      </main>
    </WebsiteShell>
  );
}

export function LoginShellPreview() {
  return (
    <AuthShell>
      <h1>Sign in to GoJet</h1>
      <p>P04 verifies the Auth shell only. Authentication behavior is implemented in P15.</p>
      <form className="shell-auth-form" onSubmit={(event) => event.preventDefault()}>
        <Field label="Email" htmlFor="shell-login-email"><Input id="shell-login-email" type="email" autoComplete="email" placeholder="you@example.com" /></Field>
        <Field label="Password" htmlFor="shell-login-password"><Input id="shell-login-password" type="password" autoComplete="current-password" /></Field>
        <Button type="submit">Sign in</Button>
      </form>
    </AuthShell>
  );
}

export function RegisterShellPreview() {
  return (
    <AuthShell visualTitle="Start with a clean workspace.">
      <h1>Create your GoJet account</h1>
      <p>P04 verifies responsive Auth structure; registration workflow remains owned by P15.</p>
      <form className="shell-auth-form" onSubmit={(event) => event.preventDefault()}>
        <Field label="Display name" htmlFor="shell-register-name"><Input id="shell-register-name" autoComplete="name" /></Field>
        <Field label="Email" htmlFor="shell-register-email"><Input id="shell-register-email" type="email" autoComplete="email" /></Field>
        <Field label="Password" htmlFor="shell-register-password"><Input id="shell-register-password" type="password" autoComplete="new-password" /></Field>
        <Button type="submit">Create account</Button>
      </form>
    </AuthShell>
  );
}
