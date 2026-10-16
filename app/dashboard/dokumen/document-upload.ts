import { browserApi } from "@/lib/api/browser-client";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api/errors";

type UploadBody = Parameters<typeof browserApi.dokumen.dokumenPostControllerUpload>[0];

// Frontend policy, not a claim that Multer enforces MIME types. No active HTML/SVG files.
const fileTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
};
export const documentAccept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
export function validateDocumentFile(file: File | null): asserts file is File {
  if (!file || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Pilih file tidak kosong, maksimal 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = fileTypes[extension];
  if (!allowed || (file.type && file.type !== "application/octet-stream" && !allowed.includes(file.type.toLowerCase()))) {
    throw new Error("Tipe file tidak sesuai. Gunakan PDF, Word, Excel, JPG, atau PNG dengan ekstensi dan MIME yang sesuai.");
  }
}

/** XHR upload events measure bytes sent, not completion of server processing. */
export function uploadDocument(body: UploadBody & { file: File; pengadaanId: string; nama: string }, onProgress: (percent: number | null) => void, signal: AbortSignal): Promise<void> {
  validateDocumentFile(body.file);
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const token = readSession(cookie)?.token;
  if (!token) return Promise.reject(new Error("Sesi berakhir. Silakan login kembali."));
  const url = new URL(`${browserApi.baseUrl.replace(/\/$/, "")}/api/dokumen/upload`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return Promise.reject(new Error("Alamat API tidak valid."));
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) if (value !== undefined) form.append(key, value);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", url.href);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => onProgress(event.lengthComputable ? Math.round((event.loaded * 100) / event.total) : null);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      reject(new Error(payload ? getApiErrorMessage(payload) : `Unggah gagal (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Koneksi gagal. Periksa jaringan/CORS dan muat ulang daftar sebelum mencoba lagi."));
    xhr.ontimeout = () => reject(new Error("Waktu unggah habis. Muat ulang daftar untuk memeriksa apakah dokumen tersimpan."));
    xhr.onabort = () => reject(new Error("Unggah dibatalkan. Periksa daftar sebelum mengulang unggah."));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      reject(new Error("Unggah dibatalkan."));
      return;
    }
    xhr.send(form);
  });
}
