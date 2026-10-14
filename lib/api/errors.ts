export type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

/** Convert generated-client HTTP errors into stable user-facing messages. */
export function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const response = error as ApiErrorPayload & { error?: unknown };
    const payload = response.error && typeof response.error === "object" ? (response.error as ApiErrorPayload) : response;
    if (Array.isArray(payload.message)) return payload.message.join(", ");
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Terjadi kesalahan. Silakan coba lagi.";
}
