import "server-only";

import { Api } from "./generated/api-generated";

/** Create request-scoped server API client; pass session token only on server. */
export function createServerApiClient(token?: string): Api<string> {
  const api = new Api<string>({
    baseUrl: process.env.LEMIGAS_API_URL ?? "http://localhost:3001",
    securityWorker: (securityData) => (securityData ? { headers: { Authorization: `Bearer ${securityData}` } } : {}),
  });

  api.setSecurityData(token ?? null);
  return api;
}
