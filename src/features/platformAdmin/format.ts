// Display helpers for the NOVA ARI console (board 14).
export const STATUS_LABEL: Record<string, string> = {
  active: "Active", trial: "Trial", suspended: "Suspended", expired: "Expired", canceled: "Cancelled", pending: "Pending",
};
export const STATUS_TONE: Record<string, string> = {
  active: "success", trial: "info", suspended: "neutral", expired: "danger", canceled: "danger", pending: "neutral",
};
export const FLAG_LABEL: Record<string, string> = {
  payment_overdue: "Payment overdue", expiring_soon: "Expiring soon", new_device: "New device",
  credits_low: "Credits low", storage_high: "Storage high", suspended: "Suspended", request_open: "Request open",
  payment_review: "Payment review",
};
export const FLAG_TONE: Record<string, string> = {
  payment_overdue: "danger", expiring_soon: "warning", new_device: "warning", credits_low: "warning",
  storage_high: "warning", suspended: "neutral", request_open: "info", payment_review: "danger",
};
export const RESULT_LABEL: Record<string, string> = {
  active: "Signed in", signed_out: "Signed out", replaced: "Replaced by a newer sign-in",
  ended_by_user: "Ended by the user", ended_by_admin: "Ended by NOVA ARI", expired: "Expired",
};
export const FAMILY_LABEL: Record<string, string> = { frris_wrris: "FRRIS and WRRIS", megis: "MEGIS" };

const GB = 1_000_000_000;

export function gigabytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes == null) return "—";
  const value = bytes / GB;
  return `${value < 10 && value > 0 ? value.toFixed(digits) : Math.round(value).toLocaleString()} GB`;
}

export function shortDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function dateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function tzs(amount: number | null | undefined): string {
  return amount == null ? "Contract" : `TZS ${amount.toLocaleString()}`;
}

export function ratio(used: number, limit: number | null | undefined): string {
  return limit == null ? `${used}` : `${used} / ${limit}`;
}
