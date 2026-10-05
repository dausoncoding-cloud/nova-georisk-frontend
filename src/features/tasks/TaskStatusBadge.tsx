import type { TaskStatus } from "./tasksApi";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`status-badge status-badge--${status}`}><span aria-hidden="true" />{status}</span>;
}
