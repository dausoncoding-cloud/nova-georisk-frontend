import { useState, type ReactNode } from "react";
import { useDialog } from "../../shared/ui/useDialog";
export function ConfirmDialog({ title, children, onClose, onConfirm, busy = false }: { title: string; children: ReactNode; onClose: () => void; onConfirm: () => void; busy?: boolean }) {
  const ref = useDialog(true, onClose);
  const [confirmed, setConfirmed] = useState(false);
  return <div className="modal-backdrop"><section className="modal-panel management-dialog" role="dialog" aria-modal="true" aria-labelledby="management-dialog-title" tabIndex={-1} ref={ref}>
    <h2 id="management-dialog-title">{title}</h2>{children}<label className="confirm-choice"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this organization-scoped change.</label><div className="form-actions"><button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="button button--primary" onClick={onConfirm} disabled={!confirmed || busy}>{busy ? "Applying…" : "Confirm change"}</button></div>
  </section></div>;
}
