import { Api } from "./generated/api-generated";

/** Browser API client. Authenticated calls should go through Next route handlers. */
export const browserApi = new Api<string>({
  baseUrl: process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001",
  securityWorker: (securityData) => (securityData ? { headers: { Authorization: `Bearer ${securityData}` } } : {}),
});
