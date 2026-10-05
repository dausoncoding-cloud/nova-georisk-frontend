import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "NOVA_");
  const bffTarget = serverEnv.NOVA_BFF_PROXY_TARGET ?? "http://localhost:8001";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": { target: bffTarget },
        "/auth": { target: bffTarget },
      },
    },
  };
});
