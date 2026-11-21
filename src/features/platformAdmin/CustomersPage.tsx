import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ErrorState } from "../../shared/ui/ErrorState";
import { LoadingState } from "../../shared/ui/LoadingState";
import { Pagination } from "../../shared/ui/Pagination";
import { fetchCustomer, fetchCustomers, fetchLoginHistory, fetchOverview, type CustomerRow } from "./adminApi";
import { AddCustomerDialog } from "./AddCustomerDialog";
import { CustomerActions } from "./CustomerActions";
import { FLAG_LABEL, FLAG_TONE, RESULT_LABEL, STATUS_LABEL, STATUS_TONE, dateTime, gigabytes, ratio, shortDate } from "./format";

const rowKey = (row: CustomerRow) => row.subscription_id ?? row.organization_id;

function Tile({ label, value, tone }: { label: string; value: number | undefined; tone?: "warning" }) {
  return (
    <div className="ari-tile">
      <span>{label}</span>
      <strong className={tone === "warning" && value ? "ari-tile__value--warning" : undefined}>{value ?? "–"}</strong>
    </div>
  );
}

export function CustomersPage() {
  const [filters, setFilters] = useState({ q: "", status: "", family: "", flag: "" });
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [adding, setAdding] = useState(false);
  const overview = useQuery({ queryKey: ["platform-admin", "overview"], queryFn: fetchOverview });
  const customers = useQuery({
    queryKey: ["platform-admin", "customers", filters, offset],
    queryFn: () => fetchCustomers({ ...filters, offset }),
    placeholderData: keepPreviousData,
  });
  const items = customers.data?.items ?? [];
  useEffect(() => {
    const first = items[0];
    if (!first) return;
    // Keep the selected customer (with its refreshed row) when it is still listed; otherwise select the first row.
    const current = selected ? items.find((row) => rowKey(row) === rowKey(selected)) : undefined;
    setSelected(current ?? first);
  }, [customers.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (name: keyof typeof filters) => (event: { target: { value: string } }) => {
    setFilters((current) => ({ ...current, [name]: event.target.value }));
    setOffset(0);
  };

  return (
    <div className="ari-page">
      <header className="ari-page__header">
        <div>
          <h1>Customers and subscriptions</h1>
          <p>Every customer, their plan, usage and account status across FRRIS, WRRIS and MEGIS.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setAdding(true)}>Add customer</button>
      </header>

      <section className="ari-tiles" aria-label="Summary">
        <Tile label="Active subscriptions" value={overview.data?.active_subscriptions} />
        <Tile label={`Expiring in ${overview.data?.expiring_soon_days ?? 7} days`} value={overview.data?.expiring_soon} />
        <Tile label="Credits used this month" value={overview.data?.credits_used_this_month} />
        <Tile label="Open security alerts" value={overview.data?.open_security_alerts} tone="warning" />
      </section>

      <section className="ari-card" aria-labelledby="customers-heading">
        <div className="ari-card__head">
          <h2 id="customers-heading">Customers</h2>
          <div className="ari-filters">
            <label className="field">Search<input type="search" placeholder="Organization or email" value={filters.q} onChange={set("q")} /></label>
            <label className="field">Status
              <select value={filters.status} onChange={set("status")}>
                <option value="">All</option>
                {["active", "suspended", "expired", "canceled", "pending", "none"].map((value) => (
                  <option key={value} value={value}>{value === "none" ? "No subscription" : STATUS_LABEL[value]}</option>
                ))}
              </select>
            </label>
            <label className="field">System
              <select value={filters.family} onChange={set("family")}>
                <option value="">All</option><option value="frris_wrris">FRRIS · WRRIS</option><option value="megis">MEGIS</option>
              </select>
            </label>
            <label className="field">Flag
              <select value={filters.flag} onChange={set("flag")}>
                <option value="">All</option>
                {Object.entries(FLAG_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
        </div>
        {customers.isPending ? <LoadingState label="Loading customers…" /> : customers.isError
          ? <ErrorState title="Customers unavailable" error={customers.error} onRetry={() => void customers.refetch()} />
          : <>
            <div className="table-wrap">
              <table className="ari-table">
                <thead><tr>
                  <th scope="col">Customer</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col">Users</th>
                  <th scope="col">Sessions</th><th scope="col">Credits</th><th scope="col">Storage</th><th scope="col">Expiry</th><th scope="col">Flags</th>
                </tr></thead>
                <tbody>
                  {items.map((row) => {
                    const active = selected && rowKey(row) === rowKey(selected);
                    return (
                      <tr key={rowKey(row)} className={active ? "is-selected" : undefined} aria-selected={active || undefined}>
                        <td data-label="Customer">
                          <button type="button" className="ari-link" onClick={() => setSelected(row)}>{row.organization_name}</button>
                          <div className="ari-sub">{row.systems.join(" · ") || "No subscription"}</div>
                        </td>
                        <td data-label="Plan">{row.plan_name ?? "—"}</td>
                        <td data-label="Status">{row.status
                          ? <span className={`ari-pill ari-pill--${STATUS_TONE[row.status] ?? "neutral"}`}>{STATUS_LABEL[row.status] ?? row.status}</span> : "—"}</td>
                        <td data-label="Users" className="ari-num">{ratio(row.users_used, row.users_limit)}</td>
                        <td data-label="Sessions" className="ari-num">{row.users_limit === 1 ? ratio(row.active_sessions, row.session_limit) : row.active_sessions}</td>
                        <td data-label="Credits" className="ari-num">{row.credits_unlimited ? "Unlimited" : row.subscription_id ? `${row.credits_used} / ${row.credits_available}` : "—"}</td>
                        <td data-label="Storage" className="ari-num">{row.storage_limit == null ? gigabytes(row.storage_used) : `${gigabytes(row.storage_used)} / ${gigabytes(row.storage_limit, 0)}`}</td>
                        <td data-label="Expiry">{shortDate(row.ends_at ?? row.renews_on)}</td>
                        <td data-label="Flags">{row.flags.length
                          ? <span className="ari-flags">{row.flags.map((flag) => <span key={flag} className={`ari-pill ari-pill--${FLAG_TONE[flag] ?? "neutral"}`}>{FLAG_LABEL[flag] ?? flag}</span>)}</span>
                          : <span className="ari-sub">None</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!items.length ? <p className="ari-empty">No customers match.</p> : null}
            <Pagination offset={offset} limit={50} total={customers.data.total} onChange={setOffset} />
          </>}
      </section>

      {selected ? <CustomerPanels row={selected} /> : null}
      {adding ? <AddCustomerDialog onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function CustomerPanels({ row }: { row: CustomerRow }) {
  const detail = useQuery({ queryKey: ["platform-admin", "customer", row.organization_id], queryFn: () => fetchCustomer(row.organization_id) });
  const history = useQuery({ queryKey: ["platform-admin", "logins", row.organization_id], queryFn: () => fetchLoginHistory(row.organization_id) });
  const usage = detail.data?.usage;
  const summary = detail.data?.subscriptions.find((item) => item.id === row.subscription_id);
  return (
    <div className="ari-panels">
      <section className="ari-card" aria-labelledby="usage-heading">
        <div className="ari-card__head ari-card__head--wrap">
          <h2 id="usage-heading">{row.organization_name} · usage this period</h2>
          <span className="ari-sub">{[row.systems.join(" "), row.plan_name, row.renews_on ? `renews ${shortDate(row.renews_on)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
        {detail.isPending ? <LoadingState label="Loading usage…" /> : detail.isError
          ? <ErrorState title="Usage unavailable" error={detail.error} onRetry={() => void detail.refetch()} />
          : <dl className="ari-usage">
            <div><dt>Analyses run</dt><dd>{usage?.analyses_run}</dd></div>
            <div><dt>Credits remaining</dt><dd>{summary?.credits.unlimited ? "Unlimited" : summary?.credits.remaining ?? "—"}</dd></div>
            <div><dt>Data processed</dt><dd>{gigabytes(usage?.data_processed_bytes, 2)}</dd></div>
            <div><dt>Downloads</dt><dd>{usage?.downloads}</dd></div>
            <div><dt>API requests</dt><dd>{usage?.api_requests.toLocaleString()}</dd></div>
            <div><dt>Registered devices</dt><dd>{usage?.registered_devices}</dd></div>
          </dl>}
        <CustomerActions row={row} />
        <p className="ari-note">Every admin action is written to the audit log with the admin's name and a reason.</p>
      </section>

      <section className="ari-card" aria-labelledby="logins-heading">
        <div className="ari-card__head ari-card__head--wrap">
          <h2 id="logins-heading">Login history</h2>
          <span className="ari-sub">Approximate location from IP{history.data?.location_attribution ? ` · ${history.data.location_attribution}` : ""}</span>
        </div>
        {history.isPending ? <LoadingState label="Loading sign-ins…" /> : history.isError
          ? <ErrorState title="Login history unavailable" error={history.error} />
          : history.data.items.length
            ? <div className="table-wrap"><table className="ari-table ari-table--compact">
              <thead><tr><th scope="col">When</th><th scope="col">Device</th><th scope="col">Location</th><th scope="col">Result</th></tr></thead>
              <tbody>{history.data.items.map((entry) => {
                const endedEarlier = entry.ended_earlier_sessions > 0;
                return (
                  <tr key={entry.id} className={endedEarlier || entry.is_new_device ? "is-attention" : undefined}>
                    <td data-label="When">{dateTime(entry.created_at)}<div className="ari-sub">{entry.user_display_name ?? entry.user_email}</div></td>
                    <td data-label="Device">{entry.browser}, {entry.os}{entry.is_new_device ? <div className="ari-sub ari-sub--warning">New device</div> : null}</td>
                    <td data-label="Location">{entry.location ?? "Unknown"}{entry.ip_address ? <div className="ari-sub">{entry.ip_address}</div> : null}</td>
                    <td data-label="Result" className={endedEarlier ? "ari-result--warning" : entry.result === "active" ? "ari-result--ok" : undefined}>
                      {endedEarlier ? "Ended earlier session" : RESULT_LABEL[entry.result] ?? entry.result}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table></div>
            : <p className="ari-empty">No sign-ins recorded yet.</p>}
      </section>
    </div>
  );
}
