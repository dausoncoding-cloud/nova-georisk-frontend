export const queryKeys = {
  authConfig: ["auth", "config"] as const,
  session: ["auth", "session"] as const,
  organization: ["organization", "current"] as const,
  projects: {
    all: ["projects"] as const,
    detail: (projectId: string) => ["projects", projectId] as const,
  },
  aois: {
    all: ["aois"] as const,
    project: (projectId: string) => ["aois", "project", projectId] as const,
    detail: (aoiId: string) => ["aois", aoiId] as const,
    boundaries: (projectId: string, query: string, offset: number) => ["aois", "boundaries", projectId, query, offset] as const,
  },
  engines: ["engines"] as const,
  engineContract: (engineKey: string) => ["engines", engineKey, "contract"] as const,
  tasks: {
    all: ["tasks"] as const,
    list: (filters: unknown) => ["tasks", "list", filters] as const,
    detail: (taskId: string) => ["tasks", taskId] as const,
  },
  results: {
    all: ["results"] as const,
    list: (filters: unknown) => ["results", "list", filters] as const,
    detail: (resultId: string) => ["results", resultId] as const,
  },
};
