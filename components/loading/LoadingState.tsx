export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
