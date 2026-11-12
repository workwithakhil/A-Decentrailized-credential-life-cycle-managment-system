import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any sub-path
  // (e.g. GitHub Pages serves it under /<repo-name>/). Routing is hash-based,
  // so no server rewrites are needed.
  base: "./",
  server: { port: 5173 },
});
