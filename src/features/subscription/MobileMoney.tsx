// "Pay with Mobile Money" (Abliner) on My subscription: owners and admins only. Pending is never paid: the page
// shows "Check your phone" and then waits for the server; credits appear only when the server says "completed".
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrapResponse } from "../../shared/api/client";
import { getErrorMessage } from "../../shared/api/errors";
import type { components } from "../../shared/api/generated/nova-browser-api";
import { IdempotentAction } from "../../shared/api/idempotency";
import { useDialog } from "../../shared/ui/useDialog";
import type { Subscription } from "./subscriptionApi";

type S = components["schemas"];
type Purpose = "top_up" | "renewal";
export type MobilePayment = S["PaymentIntentResponse"];

const OPEN = new Set(["pending"]);
const FIVE_SECONDS = 5_000;
const POLL_FAST_FOR = 3 * 60_000;
const PHONE = /^(?:\+?255|0)?[67]\d{8}$/;

export const mobileKeys = {
  offers: (subscriptionId: string) => ["billing", "abliner", "offers", subscriptionId] as const,
  payments: ["billing", "abliner", "payments"] as const,
  payment: (id: string) => ["billing", "abliner", "payment", id] as const,
};

const fetchOffers = async (subscription_id: string) =>
  unwrapResponse(await apiClient.GET("/api/v1/billing/abliner/offers", { params: { query: { subscription_id } } }));
const fetchPayments = async () => unwrapResponse(await apiClient.GET("/api/v1/billing/abliner/payments", { params: { query: { limit: 10 } } }));
const fetchPayment = async (intent_id: string) =>
  unwrapResponse(await apiClient.GET("/api/v1/billing/abliner/payments/{intent_id}", { params: { path: { intent_id } } }));
const createPayment = async (body: S["CreatePaymentRequest"], key: string) =>
  unwrapResponse(await apiClient.POST("/api/v1/billing/abliner/payments", { params: { header: { "Idempotency-Key": key } }, body }));

export function normalisePhone(raw: string): string | null {
  const value = raw.replace(/[\s\-().]/g, "");
  return PHONE.test(value) ? value : null;
}

const tzs = (amount: number | null | undefined) => (amount == null ? "" : `TZS ${amount.toLocaleString("en-GB")}`);
const day = (value: string | null | undefined) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/** The button, the open payment's status, or why Mobile Money isn't offered. */
export function MobileMoneyPay({ subscription, purpose, canManage }: { subscription: Subscription; purpose: Purpose; canManage: boolean }) {
  const offers = useQuery({ queryKey: mobileKeys.offers(subscription.id), queryFn: () => fetchOffers(subscription.id), enabled: canManage, retry: false });
  const payments = useQuery({ queryKey: mobileKeys.payments, queryFn: fetchPayments, enabled: canManage && !!offers.data?.enabled, retry: false });
  const [paying, setPaying] = useState(false);
  if (!canManage || !offers.data?.enabled) return null;
  const offer = offers.data.offers.find((item) => item.purpose === purpose);
  if (!offer) return null;
  // The latest payment for this purpose in the last hour: still waiting, or its result (kept visible after it ends).
  const recent = payments.data?.find((item) => item.subscription_id === subscription.id && item.purpose === purpose
    && Date.now() - new Date(item.created_at).getTime() < 60 * 60_000);
  const open = recent && OPEN.has(recent.status);
  return (
    <div className="sub-mobile">
      {recent ? <PaymentStatus intentId={recent.id} /> : null}
      {open ? null : !offer.available ? <p className="sub-muted sub-small">{offer.unavailable_message}</p> : (
        <button type="button" className="fr-button fr-button--secondary" onClick={() => setPaying(true)}>
          {purpose === "top_up" ? "Pay with Mobile Money" : "Renew with Mobile Money"}
        </button>
      )}
      {paying ? <PayDialog subscription={subscription} offer={offer} onClose={() => setPaying(false)} /> : null}
    </div>
  );
}

function PayDialog({ subscription, offer, onClose }: { subscription: Subscription; offer: S["PaymentOfferResponse"]; onClose: () => void }) {
  const ref = useDialog(true, onClose);
  const titleId = useId();
  const cache = useQueryClient();
  const action = useRef(new IdempotentAction());
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = normalisePhone(phone) !== null;
  const buys = offer.purpose === "top_up" ? `${offer.credits} credits` : `${subscription.plan_name ?? "Plan"} plan, ${day(offer.covers_from)} to ${day(offer.covers_until)}`;
  const mutation = useMutation({
    mutationFn: async () => {
      const body = { subscription_id: subscription.id, purpose: offer.purpose, phone: phone.trim() };
      try {
        const result = await createPayment(body, action.current.keyFor(body));
        action.current.settle();
        return result;
      } catch (error) { action.current.settle(error); throw error; }
    },
    onSuccess: (created) => {
      cache.setQueryData(mobileKeys.payment(created.id), created);
      void cache.invalidateQueries({ queryKey: mobileKeys.payments });
      onClose();
    },
  });
  return (
    <div className="modal-backdrop">
      <section className="modal-panel sub-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <h2 id={titleId}>Pay with Mobile Money</h2>
        <p><strong>{tzs(offer.amount)}</strong> for {buys}.</p>
        <form onSubmit={(event) => { event.preventDefault(); setTouched(true); if (valid) mutation.mutate(); }}>
          <label className="field">Mobile Money number (Tanzania)
            <input inputMode="tel" autoComplete="tel" value={phone} placeholder="0712 345 678" maxLength={20}
              onChange={(event) => setPhone(event.target.value)} onBlur={() => setTouched(true)} aria-invalid={touched && !valid} />
          </label>
          {touched && !valid ? <p className="inline-alert" role="alert">Enter a Tanzanian mobile number (for example 0712 345 678).</p> : null}
          <p className="sub-muted sub-small">You will get a prompt on this phone. Nothing is added until the payment is confirmed.</p>
          {mutation.isError ? <p className="inline-alert" role="alert">{getErrorMessage(mutation.error)}</p> : null}
          <div className="form-actions">
            <button type="button" className="button button--quiet" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
            <button type="submit" className="button button--primary" disabled={mutation.isPending || (touched && !valid)}>
              {mutation.isPending ? "Sending…" : `Pay ${tzs(offer.amount)}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Polls one payment: every 5 s for 3 minutes, then every 30 s, until the server reports a final state. */
export function PaymentStatus({ intentId }: { intentId: string }) {
  const cache = useQueryClient();
  const started = useRef(Date.now());
  const payment = useQuery({
    queryKey: mobileKeys.payment(intentId), queryFn: () => fetchPayment(intentId), retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && !OPEN.has(status)) return false;
      return Date.now() - started.current < POLL_FAST_FOR ? FIVE_SECONDS : 30_000;
    },
  });
  const status = payment.data?.status;
  useEffect(() => {
    if (status && !OPEN.has(status)) {
      void cache.invalidateQueries({ queryKey: ["billing"] });
    }
  }, [status, cache]);
  if (!payment.data) return null;
  const tone = status === "completed" ? "sub-ok" : status === "pending" ? "sub-pending" : "inline-alert";
  return (
    <div className={`sub-mobile-status ${tone}`} role="status" aria-live="polite">
      <strong>{status === "pending" ? "Waiting for approval…" : status === "completed" ? "Payment received" : status === "review" ? "Being checked" : "Not completed"}</strong>
      <span>{payment.data.message}</span>
      <span className="sub-muted sub-small">{tzs(payment.data.amount)} · {payment.data.phone}</span>
    </div>
  );
}
