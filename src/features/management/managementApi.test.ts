import { afterEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken, clearCsrfToken } from "../../shared/api/csrf";
import { apiClient } from "../../shared/api/client";
import { uploadDataset, changeMember, validateDataset } from "./managementApi";
afterEach(() => { clearCsrfToken(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Management BFF transport", () => {
  it("serializes the private multipart manifest and original file through the generated BFF path", async () => {
    const post = vi.spyOn(apiClient, "POST").mockResolvedValue({ data: { id: "dataset" }, response: new Response(null, { status: 201 }) } as never);
    const file = new File(["station_id,value\ns1,2\n"], "gauges.csv", { type: "text/csv" });
    await uploadDataset("project", { title: "Gauge data", category: "rainfall_stations", metadata: {} }, file);
    expect(post.mock.calls[0]?.[0]).toBe("/api/v1/projects/{project_id}/external-datasets");
    const options = post.mock.calls[0]?.[1] as unknown as { params: { path: { project_id: string } }; body: { manifest: string }; bodySerializer: (body: { manifest: string }) => FormData };
    expect(options.params.path.project_id).toBe("project"); const form = options.bodySerializer(options.body);
    expect(JSON.parse(String(form.get("manifest"))).title).toBe("Gauge data"); expect((form.get("file") as File).name).toBe("gauges.csv");
  });
  it("routes access changes through the BFF and preserves exact role/state values", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response(JSON.stringify({ user_id: "target" }), { headers: { "Content-Type": "application/json" } })); vi.stubGlobal("fetch", fetch); setCsrfToken("synthetic-test-csrf");
    await changeMember("organization", "target", { role: "analyst", status: "disabled" });
    const request = fetch.mock.calls[0]![0]; expect(request.method).toBe("PATCH"); expect(new URL(request.url).origin).toBe(window.location.origin); expect(request.headers.get("X-CSRF-Token")).toBe("synthetic-test-csrf"); expect(await request.json()).toEqual({ role: "analyst", status: "disabled" }); expect(request.headers.has("X-Nova-Role")).toBe(false);
  });
  it("protects dataset validation POST with same-origin session/CSRF transport", async () => {
    const fetch = vi.fn(async (_request: Request) => new Response(JSON.stringify({ id: "dataset" }), { headers: { "Content-Type": "application/json" } })); vi.stubGlobal("fetch", fetch); setCsrfToken("synthetic-test-csrf");
    await validateDataset("project", "dataset"); const request = fetch.mock.calls[0]![0]; expect(request.method).toBe("POST"); expect(request.credentials).toBe("include"); expect(new URL(request.url).origin).toBe(window.location.origin); expect(request.headers.get("X-CSRF-Token")).toBe("synthetic-test-csrf"); expect(request.headers.has("X-Internal-Secret")).toBe(false);
  });
});
