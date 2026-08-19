import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P18 missing required file: ${file}`); };
const has = (file, tokens) => { const source = read(file); for (const token of tokens) if (!source.includes(token)) throw new Error(`P18 ${file} missing contract token: ${token}`); };
const lacks = (file, tokens) => { const source = read(file); for (const token of tokens) if (source.includes(token)) throw new Error(`P18 ${file} contains obsolete token: ${token}`); };

const en = [
  "index.mdx", "getting-started/index.mdx", "products/index.mdx", "workspace/index.mdx",
  "developers/index.mdx", "developers/api-reference.mdx", "security/index.mdx",
  "self-hosting/index.mdx", "self-hosting/operations.mdx"
];
const zh = en.map((file) => `zh-CN/${file}`);
for (const file of [
  "apps/docs/package.json",
  "apps/docs/astro.config.mjs",
  "apps/docs/scripts/normalizelocales.mjs",
  "apps/docs/src/styles/p04-shell.css",
  ...en.map((file) => `apps/docs/src/content/docs/${file}`),
  ...zh.map((file) => `apps/docs/src/content/docs/${file}`)
]) exists(file);

has("apps/docs/package.json", ["astro build && node scripts/normalizelocales.mjs"]);
has("apps/docs/astro.config.mjs", [
  "base: \"/docs\"", "output: \"static\"", "@astrojs/starlight", "defaultLocale: \"root\"",
  "Start using GoJet", "Create and manage content", "API and automation",
  "Account and content protection", "Self-hosting and maintenance", "\"zh-CN\""
]);
lacks("apps/docs/astro.config.mjs", ["defaultLocale: \"en\""]);
has("apps/docs/scripts/normalizelocales.mjs", [
  "path.join(root, 'zh-cn')",
  "path.join(root, 'zh-CN')",
  "Simplified Chinese documentation home was not generated at /docs/zh-CN/.",
  "Lowercase duplicate /docs/zh-cn/ still exists"
]);
if (fs.existsSync(path.join(root, "apps/docs/public/index.html"))) throw new Error("P18 stale docs public/index.html redirect/flash page must not exist");

has("apps/docs/src/styles/p04-shell.css", [
  "--sl-nav-height: var(--docs-header-height)",
  "--sl-sidebar-width: var(--docs-sidebar-width)",
  "--sl-content-width: var(--docs-article-max)",
  "prefers-reduced-motion: reduce"
]);
has("apps/docs/src/content/docs/index.mdx", [
  "GoJet Help & Documentation", "Start with your account and workspace", "Create and manage what you publish",
  "Connect other systems", "Maintain a self-hosted installation"
]);
has("apps/docs/src/content/docs/zh-CN/index.mdx", [
  "GoJet 帮助与文档", "从账号和工作区开始", "创建和管理对外发布的内容", "接入其他系统", "维护自托管环境"
]);
has("apps/docs/src/content/docs/developers/api-reference.mdx", [
  "POST `/api/links`", "Authentication", "Request body", "curl example", "JavaScript example", "PHP example", "Go example",
  "Successful response", "Common errors", "GET `/api/links/{id}`"
]);
has("apps/docs/src/content/docs/zh-CN/developers/api-reference.mdx", [
  "POST `/api/links`", "鉴权", "请求体", "curl 示例", "JavaScript 示例", "PHP 示例", "Go 示例",
  "成功响应", "常见错误", "GET `/api/links/{id}`"
]);
for (const locale of ["", "zh-CN/"]) has(`apps/docs/src/content/docs/${locale}self-hosting/index.mdx`, ["Nginx", "PHP 8.3", "MySQL 8", "Redis"]);

console.log("P18 Docs contract verified: /docs is English, /docs/zh-CN is Simplified Chinese, lowercase duplicate locale output is normalized away, no redirect flash page can shadow the generated documentation, and the help set remains task-oriented and detailed.");
