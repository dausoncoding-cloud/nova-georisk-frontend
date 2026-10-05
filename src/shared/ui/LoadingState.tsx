export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="full-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
