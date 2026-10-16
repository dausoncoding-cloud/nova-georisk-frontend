# FIRRIS frontend final release-readiness audit

Audit date: **2026-10-16 (Africa/Nairobi)**. Frontend baseline: **`4524d47538aff11518dea50075b0cadb71babddd`**; backend baseline: **`98e1d4a681340420715dae82073ae64a315e1970`**. Both working trees started clean. Joint release classification: **NOT ENGINEERING READY** because of the confirmed backend credential-packaging issue and unresolved build-tool security review; successful frontend functional checks do not approve the joint release.

## API synchronization

The baseline frontend browser schema was **61 paths**, stale relative to backend **64 paths**. The backend remains authoritative. This audit copied its browser artifact and ran `npm run api:generate` and `npm run api:check`; no UI feature or runtime request behavior was changed.

Final `openapi/nova-browser-api.json` is byte-identical to the backend export, SHA-256:

`d07142c6a501f94ba445348084114e61973aee99ceee5f330c12f8ed9c32d619`

Generated `src/shared/api/generated/nova-browser-api.d.ts` matches it, SHA-256:

`688c2fa8c1e5cebea8f7a673c8e8144b5678372be06cd73b1a2d84a4dec519d5`

The three newly synchronized existing backend paths are project-scoped `/live/events`, `/live/events/{event_id}/feedback` and `/live/stream`. Existing backend dashboard, live-feed, source-bound processing/reviewed-map options and readiness/Result schema changes are now present in the artifact/types. No existing schema was removed. These declarations do not imply that new browser controls were implemented. Backend counts remain **59 internal / 64 browser** and runtime/export equality passed. The backend full unit suite passed **690** cases and the fresh disposable PostGIS suite passed **162**, both exit 0; direct empty-to-head migration reached the single `e8b5c2a71f40` head.

## Verification

| Check | Result |
| --- | --- |
| Host Node/npm | v24.21.0 / 12.0.2; Docker build uses repository Node 22 stage. |
| `npm ci` | PASS, exit 0; package manifest and lockfile unchanged. |
| `npm run api:generate` / `npm run api:check` | PASS, exit 0; final drift check against synchronized 64-path artifact. |
| Full frontend tests | **80 passed / 20 files, exit 0**, `npm test -- --maxWorkers=1`, 287.19 seconds. |
| Initial default-worker run | Failed under heavy host contention: 63 passed / 11 failed among 74 executed tests, plus one worker error. Most failures were existing 5-second timeouts; a loading assertion also timed out. Serial rerun preserved all assertions, timeouts and fixtures. Do not describe the initial default command as passing. |
| `npm run typecheck` | PASS, exit 0, independently confirmed. |
| `npm run build` | PASS, exit 0; Vite 9.28 seconds after TypeScript. |
| Production Docker build | PASS, exit 0, tracked-file context with synchronized schema/types. Dockerfile also executes generated-declaration checking and production build. |
| Image | `nova-georisk-frontend:firris-release-audit-4524d47`, ID `bbfb9256818da7b860bb6456c5a5d3fe0b34db66268ebf04a5c07fd1defafb04`. No image push. |
| Gateway configuration | `nginx -t` PASS with backend gateway config mounted into the real frontend image. |
| Isolated gateway HTTP | **PASS, exit 0; 8 HTTP checks**; actual local Nginx/BFF/API processes, no host ports/external network, synthetic production configuration. |
| Secret/private-data scan | No tracked high-confidence credential-pattern hits or prohibited paths across 103 tracked files; no prohibited historical object paths identified. Reachable-history signature checking also found zero hits across 117 frontend blobs. Scope is signature/path checking, not an exhaustive entropy, unreachable-object or vulnerability audit. |

## BFF architecture

Production API client uses `window.location.origin` with credentials included and CSRF headers on unsafe methods. Authenticated archive retrieval uses `/api/v1/tasks/{task_id}/archive` through that client; JSON is downloaded only after the authorized response. Results/COG/vector downloads use protected same-origin paths. GIS helpers reject foreign artifact URLs. No browser-direct FastAPI/internal-service URL or hardcoded production API-host bypass was found.

The only local-storage use found outside tests is a sidebar preference. Internal service headers and application access/refresh tokens are not browser storage/session material. `localhost:8001` remains confined to the Vite development BFF proxy. External OSM/CARTO basemaps are explicitly separate tile sources, not scientific API calls.

Browser deployment remains **Browser → Nginx/gateway → BFF → FastAPI**. Gateway clears incoming trusted identity/secret headers; BFF requires opaque server-side sessions/CSRF and creates trusted internal identity itself. Existing cookie, OIDC and tenancy protections are unchanged. Real authenticated OIDC browser end-to-end verification is still pending; anonymous denial/health and synthetic backend integration are not equivalent evidence.

## Security and operational limitations

`npm audit` reports one high-severity development dependency finding for locked **source-map-js 1.2.1**, [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). The advisory concerns denial of service when malformed indexed source maps are processed; patched version is 1.2.2. Observed chains are build/test tooling. `npm audit --omit=dev` reports **zero findings**. No browser-runtime exploit or credential compromise is asserted, but a reviewed correction or explicit risk decision remains outstanding. No automatic dependency updates were made.

The separate backend audit found an ignored service-account private-key file included in a previously built backend image because its Docker context exclusions are incomplete. The new clean backend audit image omits credentials, but the repository packaging rule remains unfixed and credential/image exposure review is required. Frontend success cannot authorize that joint release. See backend `docs/FIRRIS_FINAL_RELEASE_READINESS.md` for exact evidence, migration/integration results and the release finding.

Remaining operational gates include real provider login/logout/session expiry/CSRF, authenticated archives/COG ranges under deployed HTTPS, actual certificates/DNS/browser-vhost activation, representative real GIS/DEM/source interoperability, live GEE, worker/queue execution, load/monitoring/storage/backup verification. No scientific accuracy, calibration, licensed data or authoritative policy approval is supplied by these tests. Baseline frontend image tags remain floating; this audit is not a complete OS/image-CVE or reproducible-uncached-build certification.

## Files changed and final state

Only:

- `openapi/nova-browser-api.json`
- `src/shared/api/generated/nova-browser-api.d.ts`
- `docs/FIRRIS_FRONTEND_FINAL_RELEASE_READINESS.md`

No application/test source, `package.json`, `package-lock.json` or Dockerfile changed. Changes are **uncommitted and unstaged**; HEAD remains `4524d47`. Audit evidence is in `/tmp/firris-release-*` logs/JSON on the audit host. No commit, push, production deployment or external message was performed.

Final classification: **NOT ENGINEERING READY**.
