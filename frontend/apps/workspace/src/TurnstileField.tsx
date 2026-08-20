import { useEffect, useRef, useState } from "react";
import { useLocale } from "@gojet/ui";

type Config = { enabled: boolean; site_key?: string; surface: string; unavailable?: boolean };
type Api = { render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; theme: "auto" }) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: Api } }

let scriptPromise: Promise<void> | null = null;
function load() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const old = document.querySelector<HTMLScriptElement>('script[data-gojet-turnstile]');
    if (old) {
      old.addEventListener("load", () => resolve(), { once: true });
      old.addEventListener("error", () => reject(new Error("Turnstile failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.gojetTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function TurnstileField({ surface, onToken }: { surface: string; onToken: (token: string) => void }) {
  const { text } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    onToken("");
    fetch(`/api/public/turnstile?surface=${encodeURIComponent(surface)}`, { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? response.json() as Promise<Config> : Promise.reject())
      .then((value) => active && setConfig(value))
      .catch(() => active && setConfig({ enabled: false, surface, unavailable: true }));
    return () => { active = false; };
  }, [surface, onToken]);

  useEffect(() => {
    if (!config?.enabled || !config.site_key || !host.current) return;
    let id = "";
    let cancelled = false;
    setFailed(false);
    load().then(() => {
      if (cancelled || !host.current || !window.turnstile) return;
      id = window.turnstile.render(host.current, { sitekey: config.site_key!, callback: onToken, "expired-callback": () => onToken(""), "error-callback": () => { onToken(""); setFailed(true); }, theme: "auto" });
    }).catch(() => setFailed(true));
    return () => { cancelled = true; if (id && window.turnstile) window.turnstile.remove(id); };
  }, [config, onToken]);

  if (!config?.enabled) return null;
  return <div className="support-turnstile" data-turnstile-surface={surface}><div ref={host}/>{failed || config.unavailable ? <small role="alert">{text("Verification could not load. Refresh the page before submitting.", "验证组件无法加载，请刷新页面后再提交。")}</small> : null}</div>;
}
