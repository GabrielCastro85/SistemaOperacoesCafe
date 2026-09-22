import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O site publicado usa dominio proprio, portanto os assets precisam partir da raiz.
// Localmente (npm run dev/build) o base tambem permanece "/".
export default defineConfig({
  base: "/",
  plugins: [react()]
});
