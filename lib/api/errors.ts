export type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

/** Convert generated-client HTTP errors into stable user-facing messages. */
export function getApiErrorMessage(error: unknown): string {
  let status: number | undefined;
  let message: string | undefined;
  if (error && typeof error === "object") {
    const response = error as ApiErrorPayload & { status?: number; error?: unknown };
    status = response.status || response.statusCode;
    const payload = response.error && typeof response.error === "object" ? (response.error as ApiErrorPayload) : response;
    if (Array.isArray(payload.message)) message = payload.message.join(", ");
    else if (payload.message) message = payload.message;
    else if (payload.error) message = payload.error;
  }
  if (!message && error instanceof Error && error.message) message = error.message;
  message ||= "Terjadi kesalahan. Silakan coba lagi.";
  return status ? `HTTP ${status}: ${message}` : message;
}
