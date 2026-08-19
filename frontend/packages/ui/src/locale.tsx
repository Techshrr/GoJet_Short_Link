import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { surfaceCopy } from "./locale-copy";

export type GoJetLocale = "zh-CN" | "en";
const localeCookie = "gojet_locale";

const copy: Record<string, { en: string; "zh-CN": string }> = {
  ...surfaceCopy,
  "GOJET WORKSPACE": { en: "GOJET", "zh-CN": "GOJET" },
  "WORKFLOW": { en: "HOW IT WORKS", "zh-CN": "使用方式" },
  "USE CASES": { en: "WHO IT'S FOR", "zh-CN": "适用场景" },
  "DEVELOPER": { en: "INTEGRATIONS", "zh-CN": "集成与自动化" },
  "DEVELOPERS": { en: "INTEGRATIONS", "zh-CN": "集成与自动化" },
  "SECURITY": { en: "PROTECTION", "zh-CN": "安全保护" },
  "PLATFORM CONTROL": { en: "ADMINISTRATION", "zh-CN": "管理后台" },
  "CUSTOMERS": { en: "ACCOUNTS", "zh-CN": "用户与工作区" },
  "RESOURCES": { en: "CONTENT", "zh-CN": "内容资源" },
  "TRUST & SAFETY": { en: "PROTECTION", "zh-CN": "安全与风控" },
  "OPERATIONS": { en: "SERVICE", "zh-CN": "服务管理" },
  "COMMERCE": { en: "BILLING", "zh-CN": "套餐与结算" },
  "ACCESS": { en: "ADMIN ACCESS", "zh-CN": "后台权限" },
  "PLATFORM": { en: "SYSTEM SETTINGS", "zh-CN": "系统设置" },
  "CREATE": { en: "CONTENT", "zh-CN": "内容" },
  "INSIGHTS": { en: "REPORTS", "zh-CN": "数据分析" },
  "MANAGE": { en: "ORGANIZE", "zh-CN": "组织管理" },
  "WORKSPACE": { en: "WORKSPACE", "zh-CN": "工作区" },
  "Overview": { en: "Overview", "zh-CN": "概览" },
  "Users": { en: "Users", "zh-CN": "用户" },
  "Workspaces": { en: "Workspaces", "zh-CN": "工作区" },
  "Memberships": { en: "Memberships", "zh-CN": "成员关系" },
  "Links": { en: "Links", "zh-CN": "短链接" },
  "Domains": { en: "Domains", "zh-CN": "域名" },
  "QR Codes": { en: "QR Codes", "zh-CN": "二维码" },
  "Files": { en: "Files", "zh-CN": "文件" },
  "Text": { en: "Text", "zh-CN": "文本分享" },
  "Bio Pages": { en: "Bio Pages", "zh-CN": "个人主页" },
  "Analytics": { en: "Analytics", "zh-CN": "数据分析" },
  "Campaigns": { en: "Campaigns", "zh-CN": "推广活动" },
  "Tags": { en: "Tags", "zh-CN": "标签" },
  "API Keys": { en: "API Keys", "zh-CN": "API 密钥" },
  "Webhooks": { en: "Webhooks", "zh-CN": "Webhook 通知" },
  "Members": { en: "Members", "zh-CN": "成员" },
  "Billing": { en: "Billing", "zh-CN": "账单与套餐" },
  "Settings": { en: "Settings", "zh-CN": "设置" },
  "Support": { en: "Support", "zh-CN": "帮助与工单" },
  "Destination Risk": { en: "Destination checks", "zh-CN": "目标地址检测" },
  "File Security": { en: "File protection", "zh-CN": "文件安全" },
  "Abuse Reports": { en: "Abuse reports", "zh-CN": "滥用举报" },
  "Security Events": { en: "Security events", "zh-CN": "安全事件" },
  "Tickets": { en: "Support tickets", "zh-CN": "工单" },
  "Announcements": { en: "Announcements", "zh-CN": "公告" },
  "Mail": { en: "Mail", "zh-CN": "邮件记录" },
  "Jobs": { en: "Background tasks", "zh-CN": "后台任务" },
  "Services": { en: "Service status", "zh-CN": "服务状态" },
  "Plans": { en: "Plans", "zh-CN": "套餐" },
  "Payments": { en: "Payments", "zh-CN": "支付记录" },
  "FX": { en: "Exchange rates", "zh-CN": "汇率" },
  "Administrators": { en: "Administrators", "zh-CN": "管理员" },
  "Roles": { en: "Administrator roles", "zh-CN": "管理员角色" },
  "Permissions": { en: "Administrator permissions", "zh-CN": "管理员权限" },
  "Audit": { en: "Audit log", "zh-CN": "审计日志" },
  "General": { en: "General settings", "zh-CN": "基本设置" },
  "Official Domains": { en: "Official domains", "zh-CN": "官方域名" },
  "Mail Settings": { en: "Mail settings", "zh-CN": "邮件设置" },
  "Templates": { en: "Message templates", "zh-CN": "消息模板" },
  "Storage": { en: "File storage", "zh-CN": "文件存储" },
  "Integrations": { en: "Integrations", "zh-CN": "第三方集成" },
  "Administrator accounts": { en: "Administrator accounts", "zh-CN": "管理员账号" },
  "Administrator": { en: "Administrator", "zh-CN": "管理员" },
  "Name": { en: "Name", "zh-CN": "名称" },
  "Role": { en: "Role", "zh-CN": "角色" },
  "Status": { en: "Status", "zh-CN": "状态" },
  "Governance": { en: "Account actions", "zh-CN": "账号操作" },
  "Privileged administrator inventory. Server-side super-administrator checks remain authoritative for role changes.": {
    en: "Manage the people who can enter the administration area. Review each administrator's role, account status and granted permissions here; changes to high-privilege roles are verified again before they are accepted.",
    "zh-CN": "管理可以进入后台的管理员账号，并在这里查看每个账号的角色、启用状态和已授予权限。涉及高权限角色的新增或修改会再次校验，未通过权限检查的操作不会生效。"
  },
  "表格加载失败": { en: "Unable to load the list", "zh-CN": "列表加载失败" },
  "管理员会话无效或已过期": { en: "Your administrator session has expired. Please sign in again.", "zh-CN": "管理员登录已过期，请重新登录。" },
  "当前管理员没有此操作权限": { en: "Your administrator account does not have permission to perform this action.", "zh-CN": "当前管理员账号没有执行此操作的权限。" },
  "管理员操作验证失败，请刷新页面后重试": { en: "The administrator request could not be verified. Refresh the page and try again.", "zh-CN": "管理员操作验证失败，请刷新页面后重试。" },
  "Search": { en: "Search", "zh-CN": "搜索" },
  "Help": { en: "Help", "zh-CN": "帮助" },
  "Notifications": { en: "Notifications", "zh-CN": "通知" },
  "Create": { en: "Create", "zh-CN": "新建" },
  "Sign in": { en: "Sign in", "zh-CN": "登录" },
  "Get started": { en: "Get started", "zh-CN": "开始使用" },
  "Products": { en: "Products", "zh-CN": "产品" },
  "Solutions": { en: "Solutions", "zh-CN": "解决方案" },
  "Pricing": { en: "Pricing", "zh-CN": "价格" },
  "Docs": { en: "Docs", "zh-CN": "文档" },
  "Menu": { en: "Menu", "zh-CN": "菜单" },
  "Navigation": { en: "Navigation", "zh-CN": "导航" },
  "Workspace navigation": { en: "Workspace navigation", "zh-CN": "工作区导航" },
  "Admin navigation": { en: "Admin navigation", "zh-CN": "后台导航" }
};

const reverse = new Map<string, { en: string; "zh-CN": string }>();
for (const value of Object.values(copy)) {
  reverse.set(value.en, value);
  reverse.set(value["zh-CN"], value);
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

function initialLocale(): GoJetLocale {
  const saved = cookieValue(localeCookie);
  if (saved === "zh-CN" || saved === "en") return saved;
  if (typeof navigator !== "undefined" && navigator.languages.some((language) => language.toLowerCase().startsWith("zh"))) return "zh-CN";
  return "en";
}

export function localized(value: string, locale: GoJetLocale): string {
  const direct = copy[value];
  if (direct) return direct[locale];
  const pair = reverse.get(value);
  return pair?.[locale] ?? value;
}

export function localizedError(value: string | undefined, locale: GoJetLocale, status?: number): string {
  const raw = (value ?? "").trim();
  if (raw) {
    const translated = localized(raw, locale);
    if (translated !== raw) return translated;
    const wrongScript = locale === "en" ? /[\u3400-\u9fff]/.test(raw) : /\b(?:[A-Za-z]{3,}\s+){3,}[A-Za-z]{3,}\b/.test(raw);
    if (!wrongScript) return raw;
  }
  const fallback: Record<number, { en: string; "zh-CN": string }> = {
    400: { en: "The request could not be processed. Check the information and try again.", "zh-CN": "请求无法处理，请检查填写的信息后重试。" },
    401: { en: "Your sign-in has expired. Please sign in again.", "zh-CN": "登录状态已过期，请重新登录。" },
    403: { en: "Your account does not have permission to perform this action.", "zh-CN": "当前账号没有执行此操作的权限。" },
    404: { en: "The requested item could not be found.", "zh-CN": "没有找到请求的内容。" },
    409: { en: "The request conflicts with the current state. Refresh the page and try again.", "zh-CN": "当前状态已发生变化，请刷新页面后重试。" },
    422: { en: "Some information is invalid. Check the form and try again.", "zh-CN": "部分信息填写有误，请检查后重试。" },
    429: { en: "Too many requests were sent. Please wait and try again.", "zh-CN": "请求过于频繁，请稍后再试。" },
    500: { en: "The service encountered an error. Please try again later.", "zh-CN": "服务发生错误，请稍后重试。" },
    503: { en: "The service is temporarily unavailable. Please try again later.", "zh-CN": "服务暂时不可用，请稍后重试。" }
  };
  return (status ? fallback[status] : undefined)?.[locale] ?? (locale === "zh-CN" ? "操作未完成，请稍后重试。" : "The action could not be completed. Please try again.");
}

interface LocaleContextValue { locale: GoJetLocale; setLocale: (locale: GoJetLocale) => void; }
const LocaleContext = createContext<LocaleContextValue | null>(null);

function englishText(en: string, _zh: string): string { return en; }
function chineseText(_en: string, zh: string): string { return zh; }

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<GoJetLocale>(() => initialLocale());
  const setLocale = (next: GoJetLocale) => {
    if (typeof document !== "undefined") document.cookie = `${localeCookie}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setLocaleState(next);
  };
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("LocaleProvider is required");
  return { ...value, text: value.locale === "zh-CN" ? chineseText : englishText };
}

export function LocaleSwitch() {
  const { locale, setLocale } = useLocale();
  const chineseLabel = locale === "zh-CN" ? "简体中文" : "Chinese (Simplified)";
  const englishLabel = locale === "zh-CN" ? "英语" : "English";
  return <select className="gj-select" aria-label={locale === "zh-CN" ? "语言" : "Language"} value={locale} onChange={(event) => setLocale(event.target.value as GoJetLocale)}>
    <option value="zh-CN">{chineseLabel}</option><option value="en">{englishLabel}</option>
  </select>;
}

type TextState = { original: string; applied: string };
const textState = new WeakMap<Text, TextState>();
const attrState = new WeakMap<Element, Map<string, TextState>>();

function translateNode(node: Text, locale: GoJetLocale) {
  const current = node.nodeValue ?? "";
  const previous = textState.get(node);
  const original = previous && current === previous.applied ? previous.original : current;
  const trimmed = original.trim();
  const target = trimmed ? localized(trimmed, locale) : trimmed;
  const applied = target === trimmed ? original : original.replace(trimmed, target);
  if (applied !== current) node.nodeValue = applied;
  textState.set(node, { original, applied });
}

function translateAttribute(element: Element, name: string, locale: GoJetLocale) {
  const current = element.getAttribute(name);
  if (!current) return;
  let states = attrState.get(element);
  if (!states) { states = new Map(); attrState.set(element, states); }
  const previous = states.get(name);
  const original = previous && current === previous.applied ? previous.original : current;
  const applied = localized(original, locale);
  if (applied !== current) element.setAttribute(name, applied);
  states.set(name, { original, applied });
}

function translateTree(root: HTMLElement, locale: GoJetLocale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text;
    const parent = text.parentElement;
    if (parent && !parent.closest("pre, code, [data-no-localize]")) translateNode(text, locale);
    node = walker.nextNode();
  }
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((element) => {
    if (element.closest("pre, code, [data-no-localize]")) return;
    for (const name of ["placeholder", "title", "aria-label"]) translateAttribute(element, name, locale);
  });
}

export function LocalizedSurface({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    translateTree(root, locale);
    const observer = new MutationObserver(() => translateTree(root, locale));
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
    return () => observer.disconnect();
  }, [locale]);
  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}
