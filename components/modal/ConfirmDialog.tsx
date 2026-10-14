"use client";

import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Konfirmasi",
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-dark" type="button" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="btn btn-blue" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? "Memproses…" : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
