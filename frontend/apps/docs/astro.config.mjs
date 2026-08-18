import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  base: "/docs",
  output: "static",
  integrations: [
    starlight({
      title: { en: "GoJet Docs", "zh-CN": "GoJet 文档" },
      defaultLocale: "en",
      locales: {
        en: { label: "English", lang: "en" },
        "zh-CN": { label: "简体中文", lang: "zh-CN" }
      },
      customCss: ["@gojet/tokens/css", "./src/styles/p04-shell.css"],
      components: { SocialIcons: "./src/components/WorkspaceLink.astro" },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 }
    })
  ]
});
