import { useId, useState, type ReactNode } from "react";
import { getErrorMessage } from "../../shared/api/errors";
import { useDialog } from "../../shared/ui/useDialog";

// Every console action asks for a reason (written to the audit log with the admin's name), as on board 14.
export function ReasonDialog({ title, intro, confirmLabel, tone = "primary", busy, error, onClose, onConfirm, children, canConfirm = true }: {
  title: string; intro?: ReactNode; confirmLabel: string; tone?: "primary" | "danger"; busy: boolean; error: unknown;
  onClose: () => void; onConfirm: (reason: string) => void; children?: ReactNode; canConfirm?: boolean;
}) {
  const ref = useDialog(true, onClose);
  const titleId = useId();
  const [reason, setReason] = useState("");
  const ready = reason.trim().length > 0 && canConfirm && !busy;
  return (
    <div className="modal-backdrop">
      <section className="modal-panel ari-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {intro ? <div className="ari-dialog__intro">{intro}</div> : null}
        <form onSubmit={(event) => { event.preventDefault(); if (ready) onConfirm(reason.trim()); }}>
          {children}
          <label className="field">Reason (required, written to the audit log)
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={2000} required />
          </label>
          {error ? <p className="inline-alert" role="alert">{getErrorMessage(error)}</p> : null}
          <div className="form-actions">
            <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className={`button ${tone === "danger" ? "button--danger" : "button--primary"}`} disabled={!ready}>
              {busy ? "Saving…" : confirmLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
