# NOVA GeoRisk frontend

Production-oriented enterprise WebGIS for the same-origin NOVA browser gateway.

Implemented browser workflows:

- BFF-managed session bootstrap, CSRF, protected routes, and logout;
- current organization and membership context;
- project list, create, detail, update, and guarded delete;
- organization dashboard, responsive application shell, project workspaces, and keyboard command navigation;
- AOI wizard with polygon drawing, rectangles, GeoJSON, KML, and validated Shapefile ZIP preview/upload;
- guided nine-stage FIRRIS satellite workflow submission without raw JSON forms;
- task center/detail with status views, active-state polling, duration, cancellation, and retry;
- result list/detail, logical GIS layers, protected previews, validation/report metadata, and protected product download actions.

The Leaflet Result viewer decodes protected COG/GeoTIFF artifacts in the browser,
renders Flood Extent GeoJSON and the AOI boundary, supports two-product comparison,
basemaps, opacity, coordinates, scale, north, and displays CRS, bounds, legends,
validation, provenance, and grouped exports.

PNG previews, native GeoTIFF/COG rasters, and Flood Extent GeoJSON are rendered
through protected same-origin URLs. Native files remain downloadable for desktop GIS.
Pixel querying, editing, and server tile pyramids are not claimed.

See [`docs/NOVA_FRONTEND_PRODUCT_UX.md`](docs/NOVA_FRONTEND_PRODUCT_UX.md) for route structure, supported workflows, security boundaries, and explicit backend contract gaps.

## Local development

Use Node.js 22 or newer. Start the BFF on `http://localhost:8001`, then:

```bash
npm ci
npm run api:check
npm run dev
```

Vite proxies `/auth/*` and `/api/*` to the BFF. To use a different local BFF target, set the server-only `NOVA_BFF_PROXY_TARGET` environment variable before starting Vite. Do not use a `VITE_*` variable for secrets; the frontend has no browser secret configuration.

## Browser API contract

`openapi/nova-browser-api.json` is the committed, versioned release copy of the backend-owned browser contract:

```bash
npm run api:generate
npm run api:check
```

Generated declarations live in `src/shared/api/generated/` and must not be edited by hand.

To update the contract, export it in the matching `nova-georisk-backend` revision with `python scripts/export_bff_openapi.py`, copy **only** its `openapi/nova-browser-api.json` into this repository, then run `npm run api:generate`, `npm run api:check`, `npm run typecheck`, and `npm test`. Commit the browser artifact and generated declarations together. Compare SHA-256 digests of the backend and frontend browser JSON files in CI or release review; `api:check` detects declaration drift from the committed browser artifact, not backend-to-frontend drift. Never handwrite a second schema.

Build the independently versioned static image with `docker build -t nova-georisk-frontend:local .`; the backend Compose stack refers to that image through `NOVA_FRONTEND_IMAGE`. Nginx routing and BFF authorization remain backend-owned. No provider or internal API credential belongs in this image.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

Authentication remains in the BFF. The React application stores no OIDC provider token, internal API secret, or durable session credential.
