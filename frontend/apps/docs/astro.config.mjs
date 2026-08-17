import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  base: "/docs",
  output: "static",
  integrations: [
    starlight({
      title: "GoJet Documentation",
      defaultLocale: "en",
      locales: { en: { label: "English", lang: "en" }, "zh-CN": { label: "简体中文", lang: "zh-CN" } },
      sidebar: [
        { label: "Overview", items: [{ label: "V5 Documentation Foundation", slug: "en" }] }
      ]
    })
  ]
});
