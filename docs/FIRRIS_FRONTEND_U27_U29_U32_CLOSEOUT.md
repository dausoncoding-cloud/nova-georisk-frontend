# FIRRIS frontend U27 / U29 / U32 closeout

Date: 2026-10-05. Changes are uncommitted; nothing was pushed.

## Baseline and exact blockers

Read-only comparison used `../nova-georisk-backend/docs/FIRRIS_REQUIREMENTS_COMPLIANCE_MATRIX.md` (U27, U29, U32 and primary blocker rows), backend HEAD `07aefab`, and `../nova-georisk-backend/openapi/nova-browser-api.json`. Backend files and compliance status were not modified. The supplied backend suite counts (494 unit / 140 disposable PostGIS), gap count (21), and Alembic head are baseline context, not checks rerun by this frontend task.

- U27: browser class-area tables were absent. The result page displayed unstructured product metadata rather than typed analytics, explicit area denominators, and all delivered zero-cell classes.
- U29: browser quantitative plots/tables and observed-period presentation were absent; map display did not consume normalized WGS84 bounds. Generic fallback legends, sample-based raster color scaling, and uniform vector coloring could conflict with recorded product semantics.
- U32: task/result workflows had no archive API action or user-visible submitted parameters, result versions, execution provenance, observed audit history, or authenticated JSON archive download.

## Completed implementation

### U27

Result detail now presents backend `analytics.class_areas` in a structured table: product, class code/label, cells, m², ha, km², percent of valid area, denominator in m², area method, classification basis, and evidence reference. Every delivered row is retained, including zero-cell classes. Product statistics and area summaries have a separate metric/value/unit table. No area, percentages, totals, summary statistics, or scientific thresholds are calculated by the browser. Numeric statistics use declared product units; explicit area/cell/percentage field units are retained. Unknown units and absent/not-applicable evidence are stated explicitly; absent zero classes are never manufactured. Backend limitations remain visible.

### U29

The viewer uses validated `display_bounds_wgs84` for map envelopes and retains source bounds/CRS, units, nodata, resolution, and `temporal_metadata` for review. Raster colors use delivered class codes or recorded legend breaks (including the backend cartography rule for numeric legacy labels), not sample extrema. Vector polygon scores use the same recorded class colors (`value`, or `fvi_index` for vulnerability). Both legend arrays and `entries` objects and `color` / `color_hex` are supported. Generic product legends were removed.

Proj4 supplies display reprojection for registered projections, including EPSG:4326, EPSG:3857 and WGS84 UTM north/south zones. Raster display uses nearest-neighbour inverse reprojection into the delivered WGS84 envelope; vectors transform their coordinates. CRS disagreement, unknown projections, invalid envelopes, unavailable legends/scores, and nodata-only products fail visibly without guessing. Source scientific rasters remain unchanged. Projected PNG previews without an explicit WGS84 source cannot be safely warped and are withheld; protected native GIS downloads remain available.

Backend class-area, histogram, and observed-time-series points render as accessible bar charts with companion exact-value tables, units, recorded basis, evidence references, and timestamps. Bar scaling only maps delivered values to screen height. Histogram counts remain cells, with delivered bin bounds in product units. Observed change points retain the backend's two-instant comparison qualification; no trend, forecast, difference, or new observation is inferred. Delivered change statistics are presented unchanged. Existing two-layer visibility limit, bounded raster reads (1024 maximum dimension), range-only GeoTIFF delivery, request aborts, and protected same-origin product routes are preserved.

### U32

Both task detail and result detail offer an execution archive action. The generated API client calls `GET /api/v1/tasks/{task_id}/archive` with existing same-origin session credentials and unauthorized middleware. Requests are user-triggered and support loading, refresh/retry, error, and unauthorized states. The panel displays backend-redacted submitted parameters, all returned result versions, execution origin/retry/cache policy, AOI snapshot/source lineage, consistency fingerprints, observed lifecycle event fields, and backend limitations. Missing legacy history is explicit.

The endpoint contract returns JSON, not a storage link or binary ZIP. Download exports only that successful authorized response as a JSON Blob, honors plain or RFC 5987 UTF-8 Content-Disposition filenames when present, sanitizes path/control characters, supplies a stable JSON fallback, and revokes the object URL. No internal API or direct storage URL is used. Failed/inconsistent/unauthorized responses cannot be downloaded. Download errors are visible. Existing protected result package/artifact exports remain accessible through the export center.

## Contract synchronization

Frontend OpenAPI was copied byte-for-byte from the backend browser artifact: 60 → 61 paths, adding the task archive endpoint. Matching SHA-256 for both artifacts:

`24c102f53434369c5e60719ad78060d0cc6f7835a0c06348c75ceeea549e4368`

`npm run api:generate` regenerated `src/shared/api/generated/nova-browser-api.d.ts`; generated declarations were not hand-edited. Changes include ClassArea, QuantitativeSeries, ResultAnalytics, ResultInterpretation/EvidenceStatement, display bounds/temporal layer metadata, TaskArchiveResponse, ExecutionRecord/ExecutionEvent and updated backend submission/source schemas. OpenAPI bare object fields remain as generated; presentation reads backend-delivered keys rather than adding generated properties.

The sync made existing satellite `date_mode` and `preview_enhancement` defaults required in declarations. The existing submission builder now explicitly supplies backend defaults `pre-post` and `false`, with matching existing test expectations; no processing semantics or new controls were introduced. Proj4 was already a transitive dependency and is now declared directly.

## Focused tests

- `QuantitativeDelivery.test.tsx`: zero-cell retention, exact denominators, all area units, classification basis/evidence/limitations, histogram and observed timestamp charts, statistical summaries, unavailable values and absent analytics.
- `deliveredGis.test.ts`: authoritative break boundaries/colors and transparent nodata, vector score colors, missing legend/bounds failures, UTM vector transformation, Web Mercator raster reprojection, unknown projection rejection and WGS84 preservation.
- `FIRRISGisViewer.test.tsx`: existing two-layer visibility safeguard, delivered legends, normalized display bounds, source CRS, temporal metadata and explicit unavailable legend.
- `taskArchive.test.tsx`: generated same-origin authenticated request; 401/403/404/409/500 failures; encoded/plain/unsafe filename handling; Blob download and URL cleanup; loading, redacted parameters, result versions, absent legacy events and unauthorized UI without download.
- Existing GeoTIFF test now provides a delivered legend; existing satellite submission tests include the required backend defaults.

## Verification

| Check | Final result |
| --- | --- |
| `npm run api:check` | PASS; generated declarations match copied backend artifact |
| `npm test` | PASS; 20 test files, 80 tests |
| `npm run typecheck` | PASS; exit 0 |
| `npm run build` | PASS; TypeScript compilation and Vite production bundle, 341 modules |
| `docker build -t nova-georisk-frontend:local .` | PASS; includes container API drift check and production build |
| `git diff --check` | PASS |

Final Docker image: `sha256:1c3810f99db5d199f5b37fcffeea8bf930cb1f93e0440c8a829817fbffd02759`.
Docker required approved access to the host daemon after the sandbox denied its socket. The final source build was confirmed after an interrupted output session. No deployment was performed.

## Status and remaining gates

| Requirement | Browser engineering blockers | Engineering implementation across backend + browser |
| --- | --- | --- |
| U27 | Fully closed | IMPLEMENTED against backend baseline 07aefab |
| U29 | Fully closed for supported delivered data; explicit unavailable handling for unsupported/missing display metadata | IMPLEMENTED against backend baseline 07aefab |
| U32 | Fully closed | IMPLEMENTED against backend baseline 07aefab |

No remaining scoped frontend engineering blocker was identified. Unsupported projection definitions, missing scientific data/metadata, absent legacy audit history, and inapplicable quantitative series are explicit contract-dependent states rather than invented replacements. Arbitrary CRS support beyond registered/WGS84 UTM definitions is not claimed. The matrix's external gates (licensed/reviewed live observations, representative live imagery/source archives, independent area/accuracy/scientific review) remain open and cannot be closed by these UI changes. Thus this closeout supports closing the **browser engineering** gaps and treating the specified backend/browser implementation as complete; it does not assert scientific certification or independently validated live end-to-end operation. No live authenticated browser/backend acceptance session was available; verification here is contract comparison, frontend automated tests, compilation, production bundling and container build.

## Files changed

- `docs/FIRRIS_FRONTEND_U27_U29_U32_CLOSEOUT.md`
- `openapi/nova-browser-api.json`
- `package-lock.json`
- `package.json`
- `src/features/analyses/AnalysisSubmitPage.test.tsx`
- `src/features/analyses/parameters.test.ts`
- `src/features/analyses/parameters.ts`
- `src/features/results/FIRRISGisViewer.test.tsx`
- `src/features/results/FIRRISGisViewer.tsx`
- `src/features/results/QuantitativeDelivery.test.tsx`
- `src/features/results/QuantitativeDelivery.tsx`
- `src/features/results/ResultDetailPage.tsx`
- `src/features/results/deliveredGis.test.ts`
- `src/features/results/deliveredGis.ts`
- `src/features/results/gisViewer.test.ts`
- `src/features/results/gisViewer.ts`
- `src/features/tasks/TaskArchive.tsx`
- `src/features/tasks/TaskDetailPage.tsx`
- `src/features/tasks/taskArchive.test.tsx`
- `src/features/tasks/taskArchive.ts`
- `src/shared/api/generated/nova-browser-api.d.ts`
- `src/styles.css`
