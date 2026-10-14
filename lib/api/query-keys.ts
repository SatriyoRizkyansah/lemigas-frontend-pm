export const apiQueryKeys = {
  all: ["api"] as const,
  resource: (tag: string) => ["api", tag] as const,
  endpoint: (tag: string, method: string, params?: unknown) => ["api", tag, method, params ?? null] as const,
};
