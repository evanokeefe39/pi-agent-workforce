import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/ui/",
  server: {
    port: 5173,
    proxy: {
      "/lineage": "http://localhost:8090",
      "/artifacts": "http://localhost:8090",
    },
  },
  build: {
    outDir: "dist",
  },
});
