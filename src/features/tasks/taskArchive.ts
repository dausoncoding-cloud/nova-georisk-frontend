import { apiClient, unwrapResponse } from "../../shared/api/client";

export async function fetchTaskArchive(taskId: string) {
  const response = await apiClient.GET("/api/v1/tasks/{task_id}/archive", { params: { path: { task_id: taskId } } });
  return { archive: unwrapResponse(response), disposition: response.response.headers.get("content-disposition") };
}
export function archiveFilename(disposition: string | null, taskId: string): string {
  const extended = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename=(?:"([^"]+)"|([^;]+))/i);
  let name = plain?.[1] ?? plain?.[2] ?? `task-${taskId}-archive.json`;
  if (extended) { try { name = decodeURIComponent(extended); } catch { /* Use the plain filename if encoding is invalid. */ } }
  name = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? "";
  return !name || name === "." || name === ".." ? "execution-archive.json" : name;
}
export function downloadArchive(archive: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
