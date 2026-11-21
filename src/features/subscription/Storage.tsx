// Q5 (decided 2026-11-21): storage warnings at 90% and 100%. At 100% new analyses stop until space is freed or
// added; viewing and downloads always work. (a) "Free up space": download, then delete a result's files after
// typing its code (owners and admins; audited on the server). (b) "Request extra storage" from NOVA ARI.
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrapResponse } from "../../shared/api/client";
import { getErrorMessage } from "../../shared/api/errors";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { useDialog } from "../../shared/ui/useDialog";
import { fetchRequests, sendRequest, subscriptionKeys, type Subscription } from "./subscriptionApi";

type Item = components["schemas"]["StoredResultItem"];
const GB = 1_000_000_000;
const gb = (bytes: number | null | undefined) => (bytes == null ? "—" : `${Number((bytes / GB).toFixed(bytes < 10 * GB ? 2 : 0))} GB`);
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const storageKey = ["billing", "storage"] as const;

const fetchStorage = async () => unwrapResponse(await apiClient.GET("/api/v1/billing/storage"));
const deleteFiles = async ({ id, confirm }: { id: string; confirm: string }) =>
  unwrapResponse(await apiClient.POST("/api/v1/billing/storage/results/{result_id}/delete-files", { params: { path: { result_id: id } }, body: { confirm } }));

export function storageMessage(level: number | null | undefined, blocks: boolean): string | null {
  if (level === 100) return blocks
    ? "Storage is full. New analyses are paused until you free up space or add storage. You can still view and download your results."
    : "Storage is full. Free up space or request more storage.";
  if (level != null) return `Storage is ${level}% used. Free up space or request more storage before it is full.`;
  return null;
}

export function StorageCard({ subscription, canManage }: { subscription: Subscription; canManage: boolean }) {
  const storage = useQuery({ queryKey: storageKey, queryFn: fetchStorage });
  const [freeing, setFreeing] = useState(false);
  const data = storage.data;
  const percent = data?.limit ? Math.min(100, Math.round((100 * data.used) / data.limit)) : null;
  const message = storageMessage(data?.level, !!data?.blocks_at_limit);
  return (
    <section className="sub-card" id="storage" aria-labelledby="storage-heading">
      <h2 id="storage-heading">Storage</h2>
      {data ? <>
        <p className="sub-mono">{gb(data.used)}{data.limit != null ? ` of ${gb(data.limit)}` : " (no limit)"}{percent != null ? ` · ${percent}%` : ""}</p>
        {percent != null ? <div className="sub-meter" role="meter" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} className={data.level === 100 ? "is-full" : data.level ? "is-warn" : ""} /></div> : null}
        {message ? <p className={data.level === 100 ? "inline-alert" : "sub-pending"} role={data.level === 100 ? "alert" : "status"}>{message}</p> : null}
        {canManage ? <div className="sub-actions">
          <button type="button" className="fr-button fr-button--secondary" onClick={() => setFreeing(true)} disabled={!data.items.length}>Free up space</button>
        </div> : <p className="sub-muted sub-small">Ask your organisation's owner or admin to free up space or request more storage.</p>}
        {canManage ? <StorageRequest subscription={subscription} /> : null}
        {freeing ? <FreeUpSpace items={data.items} onClose={() => setFreeing(false)} /> : null}
      </> : storage.isError ? <p className="inline-alert" role="alert">{getErrorMessage(storage.error)}</p> : <p className="sub-muted">Loading…</p>}
    </section>
  );
}

function StorageRequest({ subscription }: { subscription: Subscription }) {
  const cache = useQueryClient();
  const requests = useQuery({ queryKey: subscriptionKeys.requests, queryFn: fetchRequests });
  const [amount, setAmount] = useState("5");
  const request = useMutation({ mutationFn: sendRequest, onSuccess: () => void cache.invalidateQueries({ queryKey: subscriptionKeys.requests }) });
  const open = requests.data?.find((item) => item.subscription_id === subscription.id && item.kind === "storage" && item.status === "open");
  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= 1 && value <= 10000;
  if (open) return <p className="sub-ok" role="status">Extra storage requested ({open.storage_gb} GB) on {day(open.created_at)}. NOVA ARI will send the price and payment details to the account owner.</p>;
  return (
    <form className="sub-inline-form" onSubmit={(event) => { event.preventDefault(); if (valid) request.mutate({ subscription_id: subscription.id, kind: "storage", storage_gb: value }); }}>
      <label className="field">Extra storage (GB)
        <input type="number" inputMode="numeric" min={1} max={10000} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <button type="submit" className="fr-button fr-button--secondary" disabled={!valid || request.isPending}>{request.isPending ? "Sending…" : "Request extra storage"}</button>
      {request.isError ? <p className="inline-alert" role="alert">{getErrorMessage(request.error)}</p> : null}
    </form>
  );
}

function FreeUpSpace({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const ref = useDialog(true, onClose);
  const titleId = useId();
  const [chosen, setChosen] = useState<Item | null>(null);
  return (
    <div className="modal-backdrop">
      <section className="modal-panel sub-dialog sub-dialog--wide" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>Free up space</h2>
        <p className="sub-muted">Results holding the most space come first. Download what you want to keep, then delete the files. The analysis record stays; its files cannot be recovered.</p>
        {chosen ? <ConfirmDelete item={chosen} onDone={onClose} onBack={() => setChosen(null)} /> : (
          <ul className="sub-storage-list">
            {items.map((item) => (
              <li key={item.result_id}>
                <div><strong>{item.project_name}</strong><span className="sub-muted">{item.result_type.replace(/_/g, " ")} · {day(item.created_at)} · {item.files} files · {gb(item.bytes)}</span>
                  <span className="sub-downloads">{item.downloads.map((url, index) => <a key={url} href={url} download>Download {index + 1}</a>)}</span></div>
                <button type="button" className="fr-button fr-button--secondary fr-button--small" onClick={() => setChosen(item)}>Delete files…</button>
              </li>
            ))}
          </ul>
        )}
        <div className="form-actions"><button type="button" className="button button--quiet" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function ConfirmDelete({ item, onDone, onBack }: { item: Item; onDone: () => void; onBack: () => void }) {
  const cache = useQueryClient();
  const [typed, setTyped] = useState("");
  const remove = useMutation({
    mutationFn: () => deleteFiles({ id: item.result_id, confirm: typed.trim() }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["billing"] }); onDone(); },
  });
  const matches = typed.trim().toLowerCase() === item.confirmation_code;
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (matches) remove.mutate(); }}>
      <p>Delete the {item.files} files of <strong>{item.project_name}</strong> ({gb(item.bytes)})? Download anything you need first.</p>
      <label className="field">Type <code>{item.confirmation_code}</code> to confirm
        <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      {remove.isError ? <p className="inline-alert" role="alert">{getErrorMessage(remove.error)}</p> : null}
      <div className="form-actions">
        <button type="button" className="button button--quiet" onClick={onBack} disabled={remove.isPending}>Back</button>
        <button type="submit" className="button button--danger" disabled={!matches || remove.isPending}>{remove.isPending ? "Deleting…" : "Delete files"}</button>
      </div>
    </form>
  );
}
