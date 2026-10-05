const defaultReturnTo = "/projects";

export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string") return defaultReturnTo;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return defaultReturnTo;
  }

  try {
    const origin = window.location.origin;
    const parsed = new URL(candidate, origin);
    if (parsed.origin !== origin || parsed.pathname.startsWith("/auth/")) {
      return defaultReturnTo;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultReturnTo;
  }
}

export function buildLoginUrl(returnTo: unknown, organizationId?: string): string {
  const params = new URLSearchParams({ return_to: sanitizeReturnTo(returnTo) });
  if (organizationId) params.set("organization_id", organizationId);
  return `/auth/login?${params.toString()}`;
}
