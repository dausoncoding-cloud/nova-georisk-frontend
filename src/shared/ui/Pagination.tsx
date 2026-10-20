export function Pagination({ offset, limit, total, onChange, busy = false }: {
  offset: number; limit: number; total: number; onChange: (offset: number) => void; busy?: boolean;
}) {
  if (total <= limit && offset === 0) return null;
  return <nav className="pagination" aria-label="Pagination"><span role="status">{total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : "0 results"}</span><div className="form-actions"><button type="button" className="button button--quiet button--small" disabled={busy || offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</button><button type="button" className="button button--quiet button--small" disabled={busy || offset + limit >= total} onClick={() => onChange(offset + limit)}>Next</button></div></nav>;
}
