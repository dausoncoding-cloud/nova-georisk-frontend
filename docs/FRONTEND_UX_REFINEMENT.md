# NOVA / FIRRIS frontend UX refinement

Date: 20 October 2026

## Scope and behavior

The React application, routing protection, OIDC/Auth0 behavior, same-origin BFF requests, generated OpenAPI declarations, and backend contracts are retained. No dependencies were added. No commits or pushes were made.

- **Results detail:** a compact summary and URL-addressable Overview, Maps, Metrics, Data & Files, Validation, Execution and Metadata tabs. Only the selected workspace mounts. Overview uses an inline output register and retains delivered class-area values and units, explicit quality status, limitations and one primary map. Validation separates scientific gate checks from independent validation. Source, model and raw metadata use disclosure controls.
- **Maps:** layer selection/comparison, AOI overlay, legends and protected loading are retained. Source/temporal details are expandable. Failed protected preview images show a retry/download message. The overview preview uses one layer; the Maps tab keeps the existing two-layer comparison. Map heights remain usable at small widths.
- **Files:** searchable, category-filtered, sortable, paginated artifact register replaces repeated export cards. Size, type, format, version and protected downloads remain available. The displayed generated date is explicitly labeled as the result date; the contract supplies no artifact-specific creation timestamp. Unknown sizes remain unknown and zero bytes remains zero.
- **Projects:** search, compact register and quick links to analysis and tasks. Project overview avoids repeating the project title already present in the workspace masthead. Map/report/export entry points open the corresponding result tab and expose loading/error states.
- **Tasks:** status filters have selected states, pagination resets on filter changes, progress has accessible labels, and project/AOI context is visible. Counts distinguish page counts from matching totals. Technical archive parameters and provenance are expandable.
- **Analysis creation:** keyboard-operable step navigation, current-step semantics, earlier validation of dates/numeric ranges, compact context and review, advanced preprocessing disclosure, and sticky actions. Submitted scientific parameters are unchanged.
- **Shell and other pages:** working mobile navigation at narrow widths, a usable collapsed-sidebar expand control, focus restoration, skip link, filtered workspace-page navigation and account Escape handling. Dashboard retry states and concise settings/task copy were refined.

## Shared components and visual system

`WorkspaceTabs`, `Disclosure`, `Pagination` and `useDialog` provide reusable tab keyboard behavior, progressive disclosure, pagination and modal focus containment/Escape/restoration. Shared CSS tokens standardize spacing, readable type, neutral surfaces, buttons, form fields, table density, status presentation and page widths. Native scientific tables retain horizontal scrolling within their own containers so values and units remain available.

Responsive rules cover desktop >=1440, laptop 1024–1439, tablet 768–1023 and mobile <768. Project/task/artifact tables become labeled rows on mobile; artifact sorting remains available through a mobile select. The shell uses an icon rail on tablets and a focus-contained drawer on phones. Dialogs use dynamic viewport height; forms use full-size input text on mobile.

## Verification

- **Tests:** 23 files, 88 tests passed, zero failed or skipped. Coverage includes workspace tab navigation and mounting, protected artifact links, filtering/sorting/pagination, dialog keyboard/focus behavior, analysis validation, task pagination and map preview failure handling.
- **Test environment:** Node 22 Docker build stage. The heavily loaded host timed out starting default test workers; the successful run used one fork, environment reuse with explicit React cleanup, 120-second test/hook limits and a 30-second Testing Library asynchronous limit. No repository test configuration or assertions were weakened. The temporary runner configuration is reproduced below.
- **Typecheck and production build:** passed. The final-source Docker build reran `tsc -b`, the API contract check and Vite production bundling successfully. Image: `nova-georisk-frontend:ux-refinement`, SHA-256 `2ad5bedabd9f29f9d6d50bfa1f9786a921e0580add7d334c52a2054e8696e52d`.
- **API:** generated declaration check passed. Backend and frontend browser contracts share SHA-256 `d07142c6a501f94ba445348084114e61973aee99ceee5f330c12f8ed9c32d619`.
- **Browser:** 140 fixture-backed layout checks passed: 20 page/workspace views at 1440, 1280, 1024, 820, 768, 390 and 320 CSS pixels. There was no horizontal document overflow; rendered map frames retained at least 288px height. Mobile navigation Escape/focus restoration, navigation-to-search keyboard handoff and AOI dialog viewport fit/Escape restoration passed. The final compact Overview also passed all seven widths, for 147 layout checks in total; its mobile screenshot was reviewed.
- **Accessibility:** shared tabs support arrow/Home/End navigation; dialogs trap focus and restore it on close; focus outlines, labels and table semantics were reviewed. Measured contrast includes secondary text on white 5.89:1, control borders on the light surface 3.55:1 and white text on the primary teal action 5.05:1. This is targeted verification, not a full assistive-technology certification.
- **Scope checks:** source copies match the reviewed workspace; `git diff --check` passes. Existing backend work was left untouched. No dependencies, API contracts or authentication configuration changed; no commit or push was performed.

Temporary test profile (run through `npm test -- --config ux-vitest.config.ts` in the Node 22 build stage):

```ts
// ux-vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  environment: "jsdom", globals: true,
  setupFiles: ["./src/test/setup.ts", "./ux-test-setup.ts"],
  pool: "forks", maxWorkers: 1, isolate: false,
  testTimeout: 120000, hookTimeout: 120000,
} });

// ux-test-setup.ts
import { afterEach } from "vitest";
import { configure, cleanup } from "@testing-library/react";
configure({ asyncUtilTimeout: 30000 });
afterEach(cleanup);
```

The browser matrix uses API fixtures and a preview-image placeholder. It checks layout and interactions, not live scientific raster content or authentication.

## Remaining UX debt

- Live OIDC, organization switching, production worker execution and protected large-raster throughput require the normal staging acceptance environment. Fixture-based layout tests cannot establish these outcomes.
- The API does not expose a per-artifact generated timestamp or universal independent-validation status; the UI labels missing information rather than inferring it.
- The existing stylesheet still contains historical layers. The new shared token/component rules centralize this refinement; further deletion of legacy rules should be a dedicated regression-tested cleanup.
- Large scientific tables preserve all columns with local scrolling; device-specific screen-reader and touch testing remains useful.

## Final classification

FRONTEND UX/UI REFINEMENT COMPLETE
