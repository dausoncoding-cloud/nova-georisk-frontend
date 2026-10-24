# Frontend production rollout

## Latest production acceptance — 24 October 2026

**ADMIN & EXTERNAL DATA MANAGEMENT PRODUCTION ACCEPTED**

This status supersedes the historical 20 October availability/acceptance blockers below. Those historical records are retained intact.

- Deployed frontend: `b43974e1b514d6e40e12f77fce13b45a84856781`, including UI commit `c22c2b7`. Fresh production image: `sha256:0cc61c0fbf262afe9c04c5d46dc46284a40071086b5143ff9ff0a02d6ac7cd4d`.
- Matching backend API/BFF/worker: commit `41a7fa2`, image `sha256:25c5e8187827edef8334aa33f6f0c01c81046edaba5a0e8c7eee01f9d028b33d`. Migration `f1a2b3c4d5e6` applied with existing record fingerprints preserved.
- Approved browser origin remains `https://app.novageorisk.com`; API/gateway health remains `https://api.novageorisk.com/health`. Both HTTPS endpoints return 200 with valid certificates. Nginx routing files are unchanged. Browser → BFF → FastAPI remains intact.
- Fresh build reran API declaration check, tsc and Vite. Browser contract remains 78 paths; internal 73 with FIRRIS title. Backend/frontend browser contracts match exactly.
- Frontend layer scan: 9 layers / 1,050 files; two exact public-CA symlinks reviewed against the known public bundle hash, zero unresolved findings. Raw findings retained; scanner policy unchanged. No source maps, private environment or uploaded datasets were introduced into the runtime image.
- Public JS `index-CUnLxyjc.js` SHA-256 `be4af0f45fa869d1671e7866ac9072478f7d4e3a91a2ac38f0b8d200d575b294`; CSS `index-B0xym_Kt.css` SHA-256 `79ae0b200a1338605e3fd49115c999ee877458975abc4f0e94ce812911a87783`. Both match the live frontend container; no stale asset hash mismatch was found.

### Live acceptance evidence

The approved owner completed checks in their own separate browser. The isolated Firefox automation connection disconnected; no automated authenticated screenshot, console recording or exact-width production measurement is claimed.

Owner confirmed: normal login; Administration owner membership and provisioning audit; Project/Overview/AOI/Tasks; all five External Data tabs, history and private CSV download; Tanzania Result Overview/Maps/Metrics/Data & Files/Validation/Execution/Metadata, map/legend, primary download and narrow/mobile layout. Owner reported CSRF-negative fetch 403, no unexpected JS/chunk/CORS/repeated network errors, and logout protecting routes.

A real browser mutation was additionally corroborated in PostgreSQL: synthetic version 2 `0c66e12c-ce79-459c-8036-87e4533a0679` changed Needs Metadata → Archived at `2026-10-24 16:51:22.938687+00`, actor `3908bc44-da51-42e1-8f65-dd3d6bfaefb5`, correlation `d53c4e2f-f856-4896-bdd2-365b4b38078b`. The initial incomplete confirmation was detected from unchanged server state; guided completion of the checkbox/Confirm change produced the audit event. Metadata was not required or invented for archival.

Both harmless synthetic versions are now Archived with files/history retained. No scientific approval or new analysis was created. Real scientific approval and multi-account role UI comparisons were not fabricated; no second identity was available/created. The previous 98 tests and 45 fixture-backed responsive checks remain local verification evidence, distinct from this owner-operated live acceptance.

Server checks independently verified owner/audit and tenant policy guards, private upload/validation/versioning/storage, protected Tanzania package checksum (54 artifacts / 53 package members), COG 206 delivery, immutable audits, preserved existing records, and all four app-service health checks. PostgreSQL/Redis/TLS ingress were not replaced. Both pre- and post-rollout database backups were actually restored in isolated disposable PostGIS containers.

### Recovery

Old frontend image retained: `sha256:4ba711daab9b19e42e394302946f5386bd15cee19548367c5883623882449d33`, tag `nova-georisk-frontend:rollback-before-management-20261024`. Restricted checkpoint: `/home/deploy/nova-releases/management-41a7fa2-20261024/`.

Validate recovery without changing services:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'python3 /home/deploy/nova-releases/management-41a7fa2-20261024/rollback.py frontend --check'
```

If frontend recovery is needed:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'python3 /home/deploy/nova-releases/management-41a7fa2-20261024/rollback.py frontend'
```

Retain compatible API/BFF/worker and the upgraded DB. An unconditional old-backend rollback is unsafe after managed records or membership revocations: the guarded full helper now refuses because managed history exists. Do not downgrade the DB/delete history to bypass it; use a compatible validated forward fix. Full backup checksums, exact image identities, acceptance limitations and backend recovery commands are in backend `docs/ADMIN_AND_EXTERNAL_DATA_MANAGEMENT_PRODUCTION.md`.

No rollback was executed. Aggregate quotas, external antivirus, retention policy and off-host disaster-recovery policy remain operational hardening work. No report was committed or pushed.

---

## Historical rollout record — 20 October 2026

All sections below are preserved historical evidence; their blocked labels do not describe the current 24 October release.


Date: 20 October 2026 (Africa/Nairobi).

**FRONTEND PRODUCTION ROLLOUT BLOCKED**

## Current availability incident — 20 October 2026, approximately 16:45 UTC

**The owner now reports both app and API-health timing out.** This supersedes the earlier owner-confirmed availability below. The deployment is not accepted and current host/container health cannot be established remotely.

Fresh checks from the workspace:

- Both domain names still resolve to the recorded production IPv4 `172.236.139.113`.
- TCP connections to ports **80, 443 and 22 time out**; HTTPS requests produce no HTTP response.
- A fresh SSH attempt with a 10-second connection limit also timed out, so its read-only host/container/Nginx commands did not execute.
- No recovery/rollback command, firewall change, reboot, database action or extra service replacement was performed during this incident investigation.

The failure is broader than a React route or TLS hostname error. These observations do not distinguish powered-off/unreachable host, packet filtering, provider routing or another host-level problem. The owner was asked to open the existing Linode/Lish console and run read-only uptime, Docker/SSH status, listening-port, container-status and local-SNI HTTPS checks. Recovery selection depends on that evidence. If only BFF/frontend services are unhealthy, the retained full domain rollback is available through the console; if local HTTPS works, inspect the host/provider network path rather than blindly replacing application services.

The exact rollback command remains documented below. It cannot currently be executed from this workspace because SSH is unreachable. Earlier successful activation and validation records are historical evidence, not a claim that the site is currently healthy.

## Current activation status — 20 October 2026

**FRONTEND PRODUCTION ROLLOUT BLOCKED — release last activated; current host reachability incident and authenticated UI acceptance incomplete.**

The owner confirmed the three Auth0 application settings were saved, with the API callback retained. Subsequent owner responses confirmed successful app-origin sign-in in their separate browser and fresh availability of both app and API health. A real token-free authorization flow now reaches Auth0 `/u/login` with HTTP 200 and no callback mismatch. The prepared release was activated at **2026-10-20 16:19:15 UTC / 19:19:15 EAT**:

- Frontend commit: `8465bd56380ca346e448bd996e31d03803d3648e`.
- Active frontend image/index digest: `sha256:4ba711daab9b19e42e394302946f5386bd15cee19548367c5883623882449d33`.
- Only BFF and frontend gateway containers were replaced; both passed their health checks. API, worker, TLS Nginx, Postgres and Redis container identities/start times matched the checkpoint at activation.
- Live BFF callback: `https://app.novageorisk.com/auth/callback`; credentials were unchanged. Candidate Compose was persisted as active only after successful replacement health and Nginx validation.
- Final app vhost is active; root and correct JS/CSS assets returned 200. The pending 503/login hold was removed.
- TLS Nginx was gracefully reloaded, and both Nginx layers passed `nginx -t`.

### Explicitly approved API-host browser redirects

Automatic approval review initially rejected changing API-host browser/login routing as beyond the frontend/BFF activation scope. No action occurred on that rejection. The owner then explicitly approved the redirects; the reviewed retry succeeded at approximately **16:24 UTC**.

API-host browser pages and exact `/auth/login` now return 302 to the fixed app origin, retaining path/query. This ensures the OIDC state cookie is created on the callback's app host. `/api/*`, remaining `/auth/*` (including logout/callback), `/outputs/*` protection and public `/health` retain their original BFF/gateway behavior. Source values are stripped as before. The API release header now identifies frontend `8465bd5`. Candidate and live Nginx validation passed. The domain rollback helper was extended **before** this change to restore the original API vhost.

Verified signed-out HTTP results after redirects: API root, `/projects` and `/auth/login` return 302 to the app origin; `/auth/session` returns 200 signed out; `/api/v1/projects` returns 401; `/outputs/` returns 404; `/health` returns 200.

### Acceptance evidence obtained

| Check | Current result |
| --- | --- |
| Real analyst login/callback/shell | Owner confirmed successful sign-in and visible NOVA shell in their own browser. This is owner-witnessed, not automation evidence |
| App login redirect | PASS: exact app callback, Authorization Code + PKCE S256; state cookie Secure, HttpOnly, SameSite=Lax. Cookie/query values were not recorded |
| Provider callback acceptance | PASS: provider login page HTTP 200; no callback mismatch |
| App static delivery | PASS: root and `/assets/index-BWXrSQ-B.js`, `/assets/index-CgyTnCZS.css` served from the activated release |
| Signed-out browser routes | PASS: 16 live checks across 1440/1024/768/390px. Root, Projects, Tasks and Results redirect to `/login`; SSO button enabled; no document overflow |
| Signed-out browser telemetry | PASS: zero recorded HTTP or console errors in those checks |
| Authenticated Projects/Tasks/analysis/results | NOT VERIFIED by automation. The controlled Firefox remained at Google sign-in while the owner signed into a separate browser; no session was fabricated, copied or injected |
| Tanzania task/result, seven tabs, real maps/legends, metrics/files/downloads | NOT RUN authenticated live; the prepared script stopped at its analyst-session precondition before making those checks |
| Authenticated four-width layouts, keyboard/dialog checks | NOT RUN live |
| CSRF rejection, UI logout, post-logout session invalidation | NOT RUN live; no false passing result recorded |
| Final runtime recheck | BLOCKED: subsequent new SSH connections timed out; see reachability record below |

The controlled browser was not able to use the owner’s separate browser session. The automated acceptance script explicitly required the approved real analyst and stopped when that condition was not met. Its prepared scenarios are not counted as executed checks. Earlier 88 tests / 147 fixture layout checks remain build evidence only.

### Reachability issue during final verification

After activation and successful public endpoint checks, new workspace connections to `172.236.139.113` on both TCP 22 and 443 began timing out. Repeat DNS still returns the expected production IP. Control TCP checks to Auth0 and `1.1.1.1:443` succeeded. A separate web-fetch attempt also could not retrieve the app or API-health URL. This establishes a production-host reachability problem from the verification environment; it does **not** distinguish host outage, firewall/source-IP blocking or a routing fault.

The read-only runtime script and bounded retries failed to connect over SSH, so they did not alter services or produce a completed final runtime record. No final container-health claim is substituted for that missing check. The owner freshly reloaded both the app and API-health endpoint from their separate browser and confirmed **both still load**. This is external availability evidence; the workspace-to-host timeout remains unresolved and the final administrative runtime recheck remains incomplete. No unverified firewall change or rollback was attempted through another channel.

### Rollback for the currently activated topology

Use the full domain rollback helper, **not** the earlier frontend-only or app-vhost-only helpers, for this activated release:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 \
  -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'sh /home/deploy/nova-releases/app-domain-8465bd5-20261020/rollback-domain.sh'
```

It uses the protected checkpoint, pins the old BFF/frontend image IDs, replaces only those two services with `--no-deps --no-build`, waits for health, restores active Compose **and original API vhost**, removes the new app vhost, and validates/reloads TLS Nginx. Backend/data/worker services and original runtime environment are preserved. No rollback was executed. The helper cannot be executed from this workspace while SSH is unreachable; use the approved server console/connection if recovery becomes necessary. Never delete databases, volumes or retained images to work around connectivity.

Activation evidence on the server: `/home/deploy/nova-releases/app-domain-8465bd5-20261020/activation.json` and `api-origin-alignment.json`; existing build/security/rollback evidence remains retained. Workstation: `/tmp/nova-frontend-live-8465bd5/` contains sanitized public and anonymous-browser results and prepared acceptance scripts. The unused isolated browser was closed and its task-created profile removed; the owner’s separate signed-in browser was untouched. No browser session material was exported. No production task, backend contract, scientific behavior, membership or credentials changed; no commit/push occurred.

The sections below retain the preceding preparation record. Their pending-TLS/Auth0 observations and earlier rollback instructions are historical and superseded by this activation status.

## Preparation record before activation

## Current outcome: app-domain enablement

Frontend commit `8465bd56380ca346e448bd996e31d03803d3648e` remains staged, **not activated**. App-domain DNS, certificate issuance, TLS hostname validation and an explicit app vhost are now complete. **Auth0 rejects the exact app callback with HTTP 403 / “Callback URL mismatch.”** Provider allowlist changes and real analyst acceptance remain blocked. The app frontend and login deliberately return 503 pending this gate; no insecure TLS bypass or API-host acceptance substitution was used.

Production changes in this follow-up: a new app certificate/renewal configuration, a separate app Nginx vhost, a graceful Nginx reload, and an app-only deployment-user renewal job. All seven existing production containers/images/start times are unchanged. The API vhost, live Compose, runtime environment, gateway bind configuration, live BFF callback and old frontend remain unchanged. No API, worker, Postgres or Redis replacement, backend contract change, credential rotation, membership change or task submission occurred. No commit or push was performed.

## DNS, TLS and routing

| Item | Current observed result |
| --- | --- |
| DNS | App and API resolve to `172.236.139.113`; no DNS change required or made |
| App certificate | Issued using the existing Certbot webroot and ACME account; SAN `app.novageorisk.com`; expires 18 January 2027, 15:08:50 GMT |
| Validation | OpenSSL hostname/chain verification OK (return code 0), curl TLS verification 0, Python SSL validation passed |
| API certificate | Still valid for `api.novageorisk.com`, expires 24 December 2026, 13:20:12 GMT |
| Renewal | App-specific Certbot staging renewal dry run passed; deployment-user cron runs at 03:17 and 15:17 host time, with a lock and reload only when certificate contents change |
| Ingress validation | Candidate and active `nginx -t` pass; existing TLS Nginx reloaded, not recreated |
| App vhost | Explicit `app.novageorisk.com` HTTP-to-HTTPS server and TLS server in `frontend-app.conf`; frontend/login return 503 while provider verification is pending |
| App API routing | `/api/*` and `/auth/*` traverse BFF with internal identity-header stripping; exact `/auth/login` is held at 503; no direct FastAPI route added |
| Anonymous protection | Both hosts: `/auth/session` is 200 with authenticated=false and null csrfToken; `/api/v1/projects` is 401; `/outputs/` is 404 |
| Existing API hostname | Original vhost byte-for-byte unchanged; root 200, session/protected-resource behavior unchanged |

Certificate paths are under `/etc/letsencrypt/live/app.novageorisk.com/` in the existing mounted Certbot store. API ingress remains `/home/deploy/nova-georisk-engine/deploy/nginx/conf.d/app.conf`; app ingress is the separate `/home/deploy/nova-georisk-engine/deploy/nginx/conf.d/frontend-app.conf`. The temporary HTTP-01 probe was removed.

## Exact Auth0 and BFF settings before cutover

The existing production Auth0 application must have these saved values; preserve the existing API callback for rollback:

| Setting | Required value / verification |
| --- | --- |
| Allowed Callback URLs | `https://app.novageorisk.com/auth/callback`; retain `https://api.novageorisk.com/auth/callback` during rollout |
| Allowed Logout URLs | `https://app.novageorisk.com` |
| Allowed Web Origins | `https://app.novageorisk.com` |
| Actual provider verification | Token-free public authorization probe using the currently configured client, exact app callback and PKCE returned **403 / Callback URL mismatch**. No sign-in, token exchange or provider configuration change occurred. Logout/web-origin entries are unverified; owner confirmation was requested and has not arrived |
| Live BFF callback | Still `https://api.novageorisk.com/auth/callback` to preserve the working production login while the app callback is rejected |
| Staged BFF callback | `https://app.novageorisk.com/auth/callback`; private candidate runtime file changes exactly this one environment key |
| Staged Compose | BFF env-file path changes to the private app runtime file; frontend image changes to the staged immutable digest. Other service definitions remain unchanged. BFF-only and final rollout candidates pass Compose validation; neither was activated |

NOVA retains CSRF-protected same-origin `POST /auth/logout`, which invalidates the NOVA session and clears its host-only cookie. It does not invoke Auth0 logout or send a provider return URL; listing the requested app logout origin does not add upstream SSO logout. The server-side authorization-code flow does not use browser cross-origin/silent authentication. No wildcard, SPA conversion or browser-direct internal API/CORS workaround was introduced. No Auth0 client credentials were changed.

Existing secure cookies, strict membership, bootstrap=false, `openid profile email` scopes and empty CORS allowlist remain unchanged. App-origin login requires a fresh normal session; API-host cookies will not be copied. Requirements are consistent with [Auth0 application guidance](https://auth0.com/docs/quickstart/webapp/rails) and [Auth0 origin guidance](https://support.auth0.com/center/s/article/What-is-the-difference-between-Allowed-Origins-CORS-and-Allowed-Web-Origins); actual provider readiness is explicitly distinguished above.

## Fresh staged build and security verification

| Item | Result |
| --- | --- |
| Source | Local `HEAD == origin/main == 8465bd56380ca346e448bd996e31d03803d3648e`; frontend tree clean before this report |
| Context provenance | `git archive` of the exact commit; 103 allowlisted build-input files; every server file matches its recorded SHA-256 |
| Image tag | `nova-georisk-frontend:release-8465bd5-20261020` |
| Image/index digest | `sha256:4ba711daab9b19e42e394302946f5386bd15cee19548367c5883623882449d33` |
| Build manifest/config digests | Manifest `sha256:6f46005b348d306ff191ddb74b062f536d2efe00a8b3f88c3b4c60977b4edc02`; config `sha256:1a3530e057fa1d17b5211de655a79c4777f41c602827e4f54d3edf4f1ccfd65e` |
| Commit label | `org.opencontainers.image.revision=8465bd56380ca346e448bd996e31d03803d3648e`, verified on built image |
| Docker build | PASS on production host; final image not attached to live ingress |
| API/typecheck/build | PASS: Docker build reran generated API check, `tsc -b` and Vite production bundling |
| Contract synchronization | Backend and exact-commit frontend browser contract SHA-256 both `d07142c6a501f94ba445348084114e61973aee99ceee5f330c12f8ed9c32d619` |
| Runtime contents | Static webroot has 42 files; no TypeScript source, source maps, node_modules or dotenv files; no internal API host in bundled JavaScript |
| Layer packaging scan | 9 layers / 1,046 files inspected. Raw scanner reported two OS public-CA symlink findings. Separate exact-layer review resolved both; zero unresolved findings. Raw report retained |
| CVE scan | Trivy/Grype unavailable on host; no dependency-vulnerability certification is claimed |
| Isolated runtime | PASS: temporary container with no network, published ports or production mounts; read-only filesystem with Nginx tmpfs paths; normal Docker capabilities; container removed after verification |
| Nginx/static assets | PASS: candidate `nginx -t`, root HTML, JS `/assets/index-BWXrSQ-B.js` and CSS `/assets/index-CgyTnCZS.css` return content |

The raw scanner flags `etc/ssl/cert.pem` and `etc/ssl1.1/cert.pem` by extension. Both were verified as symlinks in layer 0 resolving to `etc/ssl/certs/ca-certificates.crt`, SHA-256 `756cdfe4c3affc2e460278cc65ab01f67c3f4fc05d43fc683d7ebbdeb644e5f4`, with no private-key/service-account markers. No backend scanner policy was edited. The first smoke attempt with all capabilities dropped exited before Nginx testing; the successful isolated retry used normal Docker capabilities. These are recorded staging-tool findings, not suppressed production errors.

## Live acceptance results

| Acceptance area | Result for the new release at the approved app origin |
| --- | --- |
| Analyst login/callback, authenticated shell, logout/CSRF, signed-out route behavior | BLOCKED by verified Auth0 callback mismatch; no synthetic session or TLS bypass used |
| Navigation, sidebar/header/breadcrumbs, mobile/account menus | NOT RUN live |
| Project list/detail/actions | NOT RUN live |
| Task list/detail, progress, execution archive, filters/pagination | NOT RUN live |
| Analysis context, steps, validation/review | NOT RUN live; no duplicate task submitted |
| Completed Tanzania task `3e84090d-0cb5-4a09-a9ed-454636de56d0` | Not opened for new-release acceptance |
| Results Overview, Maps, Metrics, Data & Files, Validation, Execution, Metadata | All seven tabs remain NOT RUN live |
| Map/legend, metrics, file search/sort/protected downloads/package | NOT RUN live |
| 1440 / ~1024 / ~768 / ~390px | Each NOT RUN live; no overflow/map/dialog acceptance claimed |
| Keyboard focus/tabs/dialogs/labels/contrast | NOT RUN live |
| JS console, chunk loading, CORS, redirect loops, stale assets, mixed content | NOT RUN in the approved-origin browser; isolated asset smoke is not a substitute |

The previously reported 88 tests and 147 fixture-backed layout checks are release-preparation evidence, not live production acceptance. This run did not repeat them or reclassify them as live checks. The baseline anonymous API-host probe separately verifies the unchanged old deployment: `/auth/session` returns 200 with `authenticated=false` and null `csrfToken`; `/api/v1/projects` returns 401; `/outputs/` returns 404. Authenticated permissions and mutation/CSRF behavior of the new release remain untested live.

## Rollback point and exact commands

No BFF/frontend replacement occurred, so application rollback is not currently needed. The old working gateway image/container, shared services and runtime inputs remain retained. App TLS/vhost additions have their own rollback checkpoint below.

- Old frontend image: `nova-georisk-frontend:cutover-79c7419-20261017`, immutable ID `sha256:c807ab94bb1f0c277ae93850ec492aa5d8b6fe8dd36802866541686d02946134`.
- Additional retained tag: `nova-georisk-frontend:rollback-before-8465bd5-20261020`.
- Old gateway container: `firris-release-2f1b2dc-firris-2f1b2dc-gateway-1`, ID `6a7841247dd72da67b44dbe03ef3c4e83e399caafe2846bb890e5948c70608de`.
- Active Compose: `/home/deploy/nova-releases/firris-2f1b2dc/compose.active.json`, pre-rollout SHA-256 `90bb4434f319e17837bfb2bec68cdf81e0f80dcf3f89b3f0469ab3969823c9a4`.
- Restricted checkpoint: `/home/deploy/nova-releases/frontend-8465bd5-20261020/rollback/`. Includes protected container inspections, original Compose, immutable-image-pinned frontend rollback Compose, actual gateway bind file, TLS conf.d copy and both `nginx -T` outputs. Configuration containing runtime values remains server-side with restricted permissions.

Prepared helper: `/home/deploy/nova-releases/frontend-8465bd5-20261020/rollback-frontend.sh`. Shell syntax and captured/pinned Compose validation passed. **Not executed.** It replaces only the frontend gateway with the pinned old image, using `--no-deps --no-build`; validates Nginx, persists the rollback Compose and reloads existing TLS ingress. It does not replace backend/data/worker services.

Exact operator command, only if a frontend replacement later requires rollback:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'sh /home/deploy/nova-releases/frontend-8465bd5-20261020/rollback-frontend.sh'
```

The helper is scoped to a frontend-only replacement with unchanged gateway bind configuration, ingress and BFF settings. Any later app-domain/OIDC migration requires its own captured rollback plan; this helper must not be assumed to undo that migration. No old image, container, database, volume or prior recovery set was deleted.

## App-domain rollback checkpoint and exact commands

New restricted checkpoint: `/home/deploy/nova-releases/app-domain-8465bd5-20261020/rollback/`. It captures all seven containers, original conf.d, live Compose, runtime environment, deployment inputs, gateway bind file and deployment-user crontab. Secret-bearing snapshots and candidate environment/Compose files remain restricted on the server; no secrets were printed or exported.

To undo **only the currently active app vhost addition**, leaving all application containers and API routing alone:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'sh /home/deploy/nova-releases/app-domain-8465bd5-20261020/rollback-tls-vhost-only.sh'
```

This validated helper retains the removed app config, tests Nginx and reloads. The issued certificate can remain safely stored. To also undo the newly added renewal schedule, restore the captured deployment-user crontab:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'crontab /home/deploy/nova-releases/app-domain-8465bd5-20261020/rollback/crontab.before'
```

Before restoring a crontab later, verify no unrelated jobs have been added since this checkpoint.

For a **future BFF/frontend activation** from these prepared candidates, the new full domain rollback helper is staged and syntax-checked:

```sh
ssh -i /home/dauson/.ssh/id_ed25519 -p 22 \
  -o BatchMode=yes -o StrictHostKeyChecking=yes deploy@172.236.139.113 \
  'sh /home/deploy/nova-releases/app-domain-8465bd5-20261020/rollback-domain.sh'
```

It uses captured Compose with immutable old BFF/frontend image IDs, `--no-deps --no-build`, waits for both health checks, restores active Compose, removes only the new app vhost and validates/reloads TLS Nginx. It leaves API/worker/Postgres/Redis alone. Original runtime environment was never edited. **No rollback helper was executed.** No old image, database, volume or prior recovery set was deleted.

## Evidence and next gate

Initial build/security evidence remains `/home/deploy/nova-releases/frontend-8465bd5-20261020/`. New app enablement evidence is `/home/deploy/nova-releases/app-domain-8465bd5-20261020/`: `baseline.json`, `certbot.log`, `renewal-dry-run.log`, `tls-enablement.json`, `auth0-callback-probe.json`, and `final-enablement-check.json`. Private candidate files: `runtime.app.env`, `compose.bff-ready.json`, `compose.rollout-ready.json`; final vhost is staged as `frontend-app.final.conf`. Workstation tooling is under `/tmp/nova-app-domain-8465bd5/`. Protected configuration remains server-side.

Next gate: save and verify the exact three Auth0 settings above on the existing client, repeat the app callback probe, then activate only BFF to verify the app redirect. After that passes, activate the staged frontend and final app vhost, retain the pinned rollback checkpoint, and run real analyst login/logout and the full requested UI acceptance at 1440/1024/768/390px. Until that gate passes, completed Tanzania result, maps/downloads and authenticated UI/console acceptance remain unperformed, not accepted.

**FRONTEND PRODUCTION ROLLOUT BLOCKED**
