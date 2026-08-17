import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({ plugins: [react(), tailwindcss()], base: "/admin/", build: { outDir: "dist", emptyOutDir: true, manifest: true } });
