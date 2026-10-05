import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskArchive } from "./TaskArchive";
import { archiveFilename, downloadArchive, fetchTaskArchive } from "./taskArchive";
const payload = { task: { task_id: "task-one", execution: null }, submitted_parameters: { secret: "[REDACTED]", threshold: 0 }, results: [{ id: "result-one", version: 2 }], limitations: ["Consistency hashes are not tamper proof."] };
function response(status = 200, body: unknown = payload) {
  const res = new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "content-disposition": "attachment; filename*=UTF-8''execution%20archive.json" } });
  Object.defineProperty(res, "url", { value: "http://localhost/api/v1/tasks/task-one/archive" });
  return res;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("protected execution archive", () => {
  it("loads through the same-origin generated client with authentication", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response());
    expect((await fetchTaskArchive("task-one")).archive.submitted_parameters).toEqual(payload.submitted_parameters);
    const request = fetch.mock.calls[0]![0] as Request;
    expect(new URL(request.url).pathname).toBe("/api/v1/tasks/task-one/archive");
    expect(new URL(request.url).origin).toBe(window.location.origin);
    expect(request.credentials).toBe("include");
  });
  it.each([401, 403, 404, 409, 500])("fails closed for HTTP %s", async status => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(status, { error: { code: "denied", message: "Access denied" } }));
    await expect(fetchTaskArchive("task-one")).rejects.toMatchObject({ status });
  });
  it("handles encoded and unsafe filenames", () => {
    expect(archiveFilename("attachment; filename*=UTF-8''execution%20archive.json", "one")).toBe("execution archive.json");
    expect(archiveFilename('attachment; filename="../../archive.json"', "one")).toBe("archive.json");
    expect(archiveFilename("attachment; filename*=UTF-8''%ZZ; filename=plain.json", "one")).toBe("plain.json");
    expect(archiveFilename(null, "one")).toBe("task-one-archive.json");
  });
  it("downloads exact redacted JSON through a temporary object URL and revokes it", () => {
    vi.useFakeTimers();
    const create = vi.fn((_blob: Blob) => "blob:archive"); const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { expect(this.download).toBe("archive.json"); expect(this.href).toBe("blob:archive"); });
    downloadArchive(payload, "archive.json");
    expect(create.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(revoke).toHaveBeenCalledWith("blob:archive"); vi.useRealTimers();
  });
  it("shows loading, versions, redacted parameters and missing historical events", async () => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(done => { resolve = done; }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TaskArchive taskId="task-one" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open execution archive" }));
    expect(screen.getByRole("button", { name: "Loading archive…" })).toBeDisabled();
    await waitFor(() => expect(resolve).toBeDefined()); resolve(response());
    expect(await screen.findByText("[REDACTED]")).toBeInTheDocument();
    expect(screen.getByText("result-one")).toBeInTheDocument();
    expect(screen.getByText(/Historical audit events unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Consistency hashes are not tamper proof.")).toBeInTheDocument();
  });
  it("shows an explicit unauthorized state without a download action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(403));
    render(<QueryClientProvider client={new QueryClient()}><TaskArchive taskId="task-one" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open execution archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not authorized");
    expect(screen.queryByRole("button", { name: /Download execution/ })).not.toBeInTheDocument();
  });
});
