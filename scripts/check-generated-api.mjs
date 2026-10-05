import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const schema = resolve(root, "openapi/nova-browser-api.json");
const committed = resolve(root, "src/shared/api/generated/nova-browser-api.d.ts");
const temporary = join(tmpdir(), `nova-browser-api-${randomUUID()}.d.ts`);
const cli = resolve(root, "node_modules/openapi-typescript/bin/cli.js");

try {
  execFileSync(process.execPath, [cli, schema, "-o", temporary], {
    cwd: root,
    stdio: "inherit",
  });

  if (readFileSync(temporary, "utf8") !== readFileSync(committed, "utf8")) {
    console.error("Generated browser API types are stale. Run npm run api:generate.");
    process.exitCode = 1;
  }
} finally {
  rmSync(temporary, { force: true });
}
