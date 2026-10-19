import { getApiErrorMessage } from "./errors";
import { browserApi } from "./browser-client";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

function sessionToken(): string | null {
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return readSession(cookie)?.token ?? null;
}

async function fetchDocumentBlob(id: string): Promise<Blob> {
  const token = sessionToken();
  if (!token) throw new Error("Sesi berakhir. Silakan login kembali.");
  const url = new URL(`${browserApi.baseUrl.replace(/\/$/, "")}/api/dokumen/${encodeURIComponent(id)}/download`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Alamat API tidak valid.");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Keep the HTTP status when the API does not return JSON.
    }
    throw new Error(payload ? getApiErrorMessage(payload) : `Unduh gagal (HTTP ${response.status}).`);
  }
  return response.blob();
}

export async function openDocument(id: string): Promise<void> {
  const blob = await fetchDocumentBlob(id);
  const objectUrl = URL.createObjectURL(blob);
  const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Browser memblokir tab dokumen. Izinkan pop-up lalu coba lagi.");
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadDocument(id: string, fallbackName: string): Promise<void> {
  const blob = await fetchDocumentBlob(id);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fallbackName || "dokumen";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
