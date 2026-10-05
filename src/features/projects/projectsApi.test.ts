import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, type ProjectCreateRequest } from "./projectsApi";

describe("canonical project creation contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends a FIRRIS engine_key without the legacy analysis_module field", async () => {
    const payload: ProjectCreateRequest = {
      name: "Lower Basin Flood Study",
      description: "Production FIRRIS assessment",
      crs: "EPSG:4326",
      engine_key: "firris",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        id: "00000000-0000-0000-0000-000000000101",
        name: payload.name,
        description: payload.description,
        crs: payload.crs,
        engine_key: "firris",
        analysis_module: "FIRRIS",
        organization_id: "00000000-0000-0000-0000-000000000001",
        created_at: "2026-09-29T00:00:00Z",
        updated_at: "2026-09-29T00:00:00Z",
      }), { status: 201, headers: { "Content-Type": "application/json" } }),
    );

    const result = await createProject(payload);

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect(await (request as Request).clone().json()).toEqual(payload);
    expect(await (request as Request).clone().json()).not.toHaveProperty("analysis_module");
    expect(result.engine_key).toBe("firris");
    expect(result.analysis_module).toBe("FIRRIS");
  });
});
