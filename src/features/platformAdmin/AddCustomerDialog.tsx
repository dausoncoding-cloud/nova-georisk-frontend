import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCustomer, fetchPlans, type AddCustomerBody } from "./adminApi";
import { ReasonDialog } from "./ReasonDialog";
import { FAMILY_LABEL, tzs } from "./format";

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

// "Add customer": organisation + first subscription (+ engine access) + optionally the first owner.
export function AddCustomerDialog({ onClose }: { onClose: () => void }) {
  const cache = useQueryClient();
  const plans = useQuery({ queryKey: ["platform-admin", "plans"], queryFn: fetchPlans });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [family, setFamily] = useState<AddCustomerBody["family"]>("frris_wrris");
  const [planKey, setPlanKey] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [withOwner, setWithOwner] = useState(false);
  const [owner, setOwner] = useState({ owner_issuer: "", owner_subject: "", owner_email: "", owner_name: "" });
  const options = (plans.data ?? []).filter((plan) => plan.family === family);
  const plan = planKey || options.find((item) => !item.is_internal)?.key || "";
  const mutation = useMutation({
    mutationFn: (reason: string) => addCustomer({
      name: name.trim(), slug, family, plan_key: plan, reason, ends_at: endsAt ? new Date(`${endsAt}T00:00:00`).toISOString() : null,
      ...(withOwner ? { owner_issuer: owner.owner_issuer.trim(), owner_subject: owner.owner_subject.trim(),
        owner_email: owner.owner_email.trim() || null, owner_name: owner.owner_name.trim() || null } : {}),
    }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["platform-admin"] }); onClose(); },
  });
  const valid = name.trim().length >= 2 && slug.length >= 3 && !!plan && (!withOwner || (!!owner.owner_issuer.trim() && !!owner.owner_subject.trim()));
  const ownerField = (key: keyof typeof owner, label: string) => (
    <label className="field">{label}<input value={owner[key]} onChange={(e) => setOwner((current) => ({ ...current, [key]: e.target.value }))} /></label>
  );
  return (
    <ReasonDialog title="Add customer" confirmLabel="Add customer" busy={mutation.isPending} error={mutation.error} canConfirm={valid}
      onClose={onClose} onConfirm={(reason) => mutation.mutate(reason)}
      intro={<p>Creates the organisation, its subscription and access to the system. Monthly credits are granted on first use.</p>}>
      <div className="ari-grid">
        <label className="field">Organisation name<input value={name} maxLength={255} onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(slugify(e.target.value)); }} required /></label>
        <label className="field">Short name<input value={slug} maxLength={64} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }} required /></label>
        <label className="field">System
          <select value={family} onChange={(e) => { setFamily(e.target.value as AddCustomerBody["family"]); setPlanKey(""); }}>
            {Object.entries(FAMILY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field">Plan
          <select value={plan} onChange={(e) => setPlanKey(e.target.value)} disabled={plans.isPending}>
            {options.map((item) => <option key={item.key} value={item.key}>{item.name}{item.is_internal ? " (internal, not sold)" : ` · ${tzs(item.monthly_price)}`}</option>)}
          </select>
        </label>
        <label className="field">End date (optional)<input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
      </div>
      <label className="confirm-choice"><input type="checkbox" checked={withOwner} onChange={(e) => setWithOwner(e.target.checked)} /> Add the first owner now</label>
      {withOwner ? <>
        <p className="ari-sub">Use the exact identity-provider issuer and the person's verified subject (as on the Administration page). This creates NOVA access, not an identity-provider account.</p>
        <div className="ari-grid">
          {ownerField("owner_issuer", "Identity-provider issuer")}{ownerField("owner_subject", "Verified subject")}
          {ownerField("owner_email", "Email (optional)")}{ownerField("owner_name", "Name (optional)")}
        </div>
      </> : null}
    </ReasonDialog>
  );
}
