import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  base: "/docs",
  output: "static",
  integrations: [
    starlight({
      title: { en: "GoJet Help", "zh-CN": "GoJet 帮助文档" },
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        "zh-CN": { label: "简体中文", lang: "zh-CN" }
      },
      sidebar: [
        { label: "Overview", translations: { "zh-CN": "概览" }, slug: "index" },
        {
          label: "Start using GoJet",
          translations: { "zh-CN": "开始使用 GoJet" },
          items: [{ slug: "getting-started" }]
        },
        {
          label: "Create and manage content",
          translations: { "zh-CN": "创建与管理内容" },
          items: [{ slug: "products" }]
        },
        {
          label: "Workspace and account settings",
          translations: { "zh-CN": "工作区与账号设置" },
          items: [{ slug: "workspace" }]
        },
        {
          label: "API and automation",
          translations: { "zh-CN": "API 与自动化" },
          items: [{ slug: "developers" }, { slug: "developers/api-reference" }]
        },
        {
          label: "Account and content protection",
          translations: { "zh-CN": "账号与内容保护" },
          items: [{ slug: "security" }]
        },
        {
          label: "Self-hosting and maintenance",
          translations: { "zh-CN": "自托管与维护" },
          items: [{ slug: "self-hosting" }, { slug: "self-hosting/operations" }]
        }
      ],
      customCss: ["@gojet/tokens/css", "./src/styles/p04-shell.css"],
      components: { SocialIcons: "./src/components/WorkspaceLink.astro" },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 }
    })
  ]
});
