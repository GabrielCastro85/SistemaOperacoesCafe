import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Site completo (mesmas telas do app) publicado em graobase.com.br/app/.
export default defineConfig({
  root: resolve(__dirname, "web"),
  base: "/app/",
  envDir: resolve(__dirname, "web"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  resolve: {
    alias: { electron: resolve(__dirname, "web/electronRenderer.ts") }
  },
  server: { host: "127.0.0.1", port: 5175, strictPort: true, fs: { allow: [resolve(__dirname)] } },
  build: { outDir: resolve(__dirname, "dist-web"), emptyOutDir: true }
});
