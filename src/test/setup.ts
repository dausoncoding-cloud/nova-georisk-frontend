import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Backlog §4.7 item 24 (r6.2): with Vitest's default parallel workers on a 4-core machine, async lookups (findBy*,
// waitFor) sometimes missed the 1 s default wait under load, although the UI was correct. A longer wait changes no
// assertion; a lookup that passes still returns as soon as the element appears.
configure({ asyncUtilTimeout: 5000 });
