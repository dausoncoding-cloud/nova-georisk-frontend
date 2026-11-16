# NOVA frontend product UX

## Purpose

The NOVA browser application is the organization-scoped WebGIS workspace for FIRRIS. It uses only the generated browser contract in `openapi/nova-browser-api.json`; provider tokens and `X-Internal-Secret` never enter the browser. The BFF owns login, session, logout, CSRF validation, and current-organization selection.

## Information architecture

After sign-in without a deep link, the BFF callback returns to `/`, the NOVA-GeoRisk suite home ("Your systems"). A deep link (for example `/login?return_to=/frris/overview`) is kept. FRRIS opens when the organization has access to the `firris` engine (`GET /api/v1/engines`); WRRIS and MEGIS are shown as "In development" and are not links.

The FRRIS shell has a white sidebar: the NOVA-GeoRisk brand (link to the suite home), a system switcher (FRRIS current; WRRIS and MEGIS listed as "In development", not clickable), the primary FRRIS pages (Analyses, New analysis, Data catalog, Exports), a "Workspace" disclosure with every other page (Overview at `/frris/overview`, Projects, AOIs, Results, Maps, Reports, External data, Administration for admins and owners, Settings), page search (Ctrl/⌘ K), and the account (user, organization · role, organization picker when there are several memberships, Sign out). A selected project opens a persistent workspace with these tabs:

1. Overview
2. AOI
3. Data
4. Analysis
5. Tasks
6. Results
7. Map
8. Reports
9. Exports

From 900 px the sidebar is sticky beside the content; its navigation scrolls while the account block stays pinned at the bottom. Below 900 px a top bar shows the brand, the current system and a menu button ("Open menu"); the sidebar opens as a modal drawer (focus trapped, Escape/backdrop/Close menu close it and return focus to the button, and it closes on navigation).

FRRIS Analyses list (`/frris/analyses`): a "Latest completed" card (newest FRRIS result; AOI name, target period, the accuracy scope title from the API and its Overall accuracy, Kappa, F1 (flood candidate) and AUC; the independent Sentinel-2 scope is used when it was assessed, otherwise the internal scope is shown under its own title with the independent status) and a table of analyses (AOI name and project, target period, AOI area, status, created). Status filters keep the API values in `?status=` (All, Running, Queued, Completed, Needs attention = failed, Canceled) and wrap on narrow screens. Names and areas come from the project AOI lists, target periods from the FRRIS result list (latest 50); values not yet known (for example the target period of a running analysis) are shown as "—". Search filters the analyses on the current page. Organizations without analyses see the "No analyses yet" empty state.

FRRIS addresses: `/frris` opens the Analyses list at `/frris/analyses`; the former dashboard is `/frris/overview`. Old `/tasks` links redirect to `/frris/analyses` with their query and hash; `/tasks/:taskId` is unchanged.

Fonts are self-hosted (no external requests): Inter for the UI and IBM Plex Mono for numbers (`.fr-num`), both SIL OFL 1.1. The licence texts live next to the files in `src/assets/fonts/` and are emitted to `dist/licenses/fonts/` by the build.

## Supported product journeys

### AOI creation

The AOI wizard supports:

- interactive polygon drawing;
- rectangle coordinates;
- GeoJSON Polygon and MultiPolygon imports;
- KML polygon imports; and
- zipped Shapefile import with SHP, SHX, and DBF archive checks.

Shapefiles are previewed in the browser, but the archive is submitted to `/api/v1/aoi/upload` so the backend remains the authoritative validation and reprojection boundary. GeoJSON, KML, drawing, and rectangle workflows persist through `/api/v1/aoi`. Browser area and perimeter measurements are labelled estimates; stored API metrics are authoritative.

GeoPackage and administrative-boundary cards remain visible but disabled. The current OpenAPI contract has neither a GeoPackage ingestion endpoint nor an administrative-boundary catalog/selection endpoint. The application does not simulate these operations.

### FIRRIS analysis builder

The guided builder presents nine reviewable stages: project context, AOI, event periods, satellite data, preprocessing, sampling, products, validation/output, and final review. It emits the existing typed `/api/v1/analyses` request. The UI does not expose a raw JSON processing payload.

The data stage reflects the production workflow inputs: Sentinel-1 GRD, Sentinel-2 Surface Reflectance, CHIRPS Daily, SRTM/ALOS elevation, and JRC Global Surface Water. It does not claim Landsat support because the current FIRRIS execution contract does not use Landsat.

Product cards are sourced from the entitled engine contract. Products without an available delivery type are shown as planned and cannot be selected.

### Task and result operations

The task center offers status views, progress, duration, live polling for active jobs, and links into persistent task detail actions. Project result workspaces lead to protected GIS exploration, reports, and exports. Artifact downloads continue to use same-origin protected result URLs.

## GIS viewer

The result viewer uses Leaflet for pan, zoom, fit-to-bounds, scale, basemap switching, AOI overlay, vector GeoJSON, raster image overlays, legends, opacity, layer selection, and two-product comparison. COG/GeoTIFF reads retain the existing credentialed HTTP range-loading implementation; pixels are decoded locally and converted to an in-memory display image. Artifact URLs are never exposed as local filesystem paths.

Interactive display currently supports EPSG:4326 and EPSG:3857 bounds. Other declared CRSs remain downloadable and produce an explicit viewer limitation rather than a falsely positioned layer. This is deliberate CRS safety.

## Frontend architecture

- React Router owns route-level code splitting and project workspace nesting.
- TanStack Query owns API server state, invalidation, and active-task polling.
- `openapi-fetch` consumes generated `openapi-typescript` declarations.
- Feature modules own workflow UI and typed API wrappers.
- Shared UI provides icons, loading/error states, and accessible toast feedback.
- Leaflet/React Leaflet own interactive map behavior.
- `shpjs` is used only for local Shapefile preview; backend validation is authoritative.

## Accessibility and resilience

Controls use native buttons, labels, fieldsets, dialogs, tables, and progress elements. Keyboard focus receives a visible outline, command navigation is available with Control/Command+K, toasts use a polite live region, and reduced-motion preferences disable nonessential transitions. Loading, empty, unavailable-contract, API error, and retry states remain visible to the user.

## Security boundaries

- All requests are same-origin and send the opaque session cookie with `credentials: include`.
- Mutation requests receive the BFF-issued CSRF header through shared client middleware.
- Organization and project authorization is enforced by the API; the UI does not infer access from provider claims.
- Protected raster range requests and exports use authenticated result endpoints.
- No `VITE_*` secret, provider token, internal secret, filesystem path, or Earth Engine credential is used by frontend code.

## Known contract gaps

The following require backend/OpenAPI work before they can become real product controls:

- GeoPackage ingestion;
- an administrative-boundary catalog and selection contract;
- server-side AOI validation previews before persistence;
- a general cross-entity workspace search endpoint;
- user notifications beyond active-task polling; and
- browser reprojection for arbitrary projected CRSs.

The command palette therefore provides safe navigation, not fabricated cross-entity search. Notifications indicate active jobs only.

## Verification commands

Run from `frontend/`:

```text
npm run api:check
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

For release review, also scan generated assets and source for `X-Internal-Secret`, OIDC client secrets, bearer tokens, and local artifact paths. Browser end-to-end verification still requires a live HTTPS staging topology with Auth0 and real FIRRIS artifacts.
