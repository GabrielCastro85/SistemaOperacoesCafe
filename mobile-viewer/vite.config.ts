import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GITHUB_PAGES so' e' setada pelo workflow de deploy (.github/workflows/mobile-viewer-pages.yml)
// -- localmente (npm run dev/build) o base continua "/" normalmente.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/SistemaOperacoesCafe/" : "/",
  plugins: [react()]
});
