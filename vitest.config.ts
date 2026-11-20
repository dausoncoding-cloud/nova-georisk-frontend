import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // r6.2 (backlog §4.7 item 24): async waits are up to 5 s (src/test/setup.ts); a multi-step test needs room for several.
    testTimeout: 15000,
  },
});
