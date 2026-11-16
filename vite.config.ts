import { readFileSync } from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The self-hosted fonts are OFL 1.1: ship each licence text with the build, next to the hashed font files.
function fontLicences(): Plugin {
  return {
    name: "nova-font-licences",
    apply: "build",
    generateBundle() {
      for (const family of ["inter", "ibm-plex-mono"]) {
        this.emitFile({ type: "asset", fileName: `licenses/fonts/${family}-OFL.txt`, source: readFileSync(`src/assets/fonts/${family}/OFL.txt`, "utf8") });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "NOVA_");
  const bffTarget = serverEnv.NOVA_BFF_PROXY_TARGET ?? "http://localhost:8001";

  return {
    plugins: [react(), fontLicences()],
    server: {
      proxy: {
        "/api": { target: bffTarget },
        "/auth": { target: bffTarget },
      },
    },
  };
});
