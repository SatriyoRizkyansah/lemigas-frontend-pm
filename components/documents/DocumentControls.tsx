"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import { openDocument } from "@/lib/api/download";

type UploadDocumentFieldProps = {
  id: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  accept?: string;
  helperText?: string;
  onFileChange?: (file: File | null) => void;
};

export function UploadDocumentField({ id, name, required = true, disabled, accept = ".pdf,.doc,.docx,.xls,.xlsx,image/*", helperText, onFileChange }: UploadDocumentFieldProps) {
  const [file, setFile] = useState<File | null>(null);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    onFileChange?.(nextFile);
  }

  return (
    <div className="space-y-2">
      <label
        className={`group relative flex min-h-[104px] cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 py-4 transition-colors ${
          disabled ? "cursor-not-allowed border-border bg-muted/30 opacity-60" : "border-primary/30 bg-primary/[0.025] hover:border-primary/60 hover:bg-primary/[0.05]"
        }`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105" aria-hidden="true">
          {file ? (
            <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.8">
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{file ? file.name : "Pilih dokumen untuk diunggah"}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Klik untuk mengganti file` : helperText ?? "PDF, DOC, DOCX, XLS, XLSX atau gambar · Maksimal 10 MB"}</span>
        </span>
        <span className="shrink-0 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors group-hover:border-primary/30 group-hover:text-primary">{file ? "Ganti file" : "Telusuri"}</span>
        <input
          id={id}
          name={name}
          type="file"
          accept={accept}
          required={required}
          disabled={disabled}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Pilih file dokumen"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {file ? (
        <button type="button" className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => selectFile(null)}>
          Hapus pilihan
        </button>
      ) : null}
    </div>
  );
}

type ReadDocumentButtonProps = { documentId: string; name: string; disabled?: boolean };

export function ReadDocumentButton({ documentId, name, disabled }: ReadDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function read() {
    setLoading(true);
    setError("");
    try {
      await openDocument(documentId);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" variant="link" disabled={disabled || loading} onClick={() => void read()}>
        {loading ? "Membuka…" : name}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
