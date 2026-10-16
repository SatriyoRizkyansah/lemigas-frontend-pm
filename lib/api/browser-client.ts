import { Api } from "./generated/api-generated";

const notifyingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

  if (response.ok && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    const message = payload && typeof payload.message === "string" ? payload.message.trim() : "";
    if (message && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
    }
  }

  return response;
};

/** Browser API client. Authenticated calls should go through Next route handlers. */
export const browserApi = new Api<string>({
  baseUrl: process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001",
  customFetch: notifyingFetch,
  securityWorker: (securityData) => (securityData ? { headers: { Authorization: `Bearer ${securityData}` } } : {}),
});
