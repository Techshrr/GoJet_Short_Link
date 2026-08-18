import { useMemo, useState, type FormEvent } from "react";
import type { BillingPlan, PlanCreateInput, PlanWriteInput } from "@gojet/api-client";
import { Alert, Button, Checkbox, Field, Input, Select, Switch, Textarea } from "@gojet/ui";
import { adminError, billingPeriods } from "./commerce";

interface Props {
  plan?: BillingPlan;
  busy?: boolean;
  error?: unknown;
  onSubmit: (input: PlanCreateInput | PlanWriteInput) => void;
}

function featureText(value: unknown) {
  return Array.isArray(value) ? value.map(String).join("\n") : "";
}

export function PlanForm({ plan, busy = false, error, onSubmit }: Props) {
  const editing = Boolean(plan);
  const initialPeriods = useMemo(() => new Set(plan?.billing_periods?.length ? plan.billing_periods : billingPeriods), [plan]);
  const [code, setCode] = useState(plan?.code ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [status, setStatus] = useState<"active" | "archived">(plan?.status ?? "active");
  const [currency, setCurrency] = useState(plan?.currency ?? "USD");
  const [isPublic, setIsPublic] = useState(plan?.is_public ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(plan?.display_order ?? 100));
  const [price, setPrice] = useState(String(plan?.monthly_price_cents ?? 0));
  const [links, setLinks] = useState(String(plan?.link_limit ?? 100));
  const [qr, setQR] = useState(String(plan?.qr_limit ?? 25));
  const [text, setText] = useState(String(plan?.text_limit ?? 25));
  const [bio, setBio] = useState(String(plan?.bio_limit ?? 3));
  const [storage, setStorage] = useState(String(plan?.file_storage_bytes ?? 1073741824));
  const [members, setMembers] = useState(String(plan?.member_limit ?? 3));
  const [retention, setRetention] = useState(String(plan?.analytics_retention_days ?? 30));
  const [features, setFeatures] = useState(featureText(plan?.features));
  const [periods, setPeriods] = useState(initialPeriods);

  const togglePeriod = (period: string, checked: boolean) => setPeriods((current) => {
    const next = new Set(current);
    if (checked) next.add(period); else next.delete(period);
    return next;
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const base: PlanWriteInput = {
      name: name.trim(), description: description.trim(), status, currency: currency.trim().toUpperCase(), is_public: isPublic,
      display_order: Number(displayOrder), billing_periods: billingPeriods.filter((item) => periods.has(item)), monthly_price_cents: Number(price),
      link_limit: Number(links), qr_limit: Number(qr), text_limit: Number(text), bio_limit: Number(bio), file_storage_bytes: Number(storage),
      member_limit: Number(members), analytics_retention_days: Number(retention), features: features.split("\n").map((item) => item.trim()).filter(Boolean)
    };
    onSubmit(editing ? base : { ...base, code: code.trim().toLowerCase() });
  };

  return <form className="commerce-plan-form" onSubmit={submit}>
    {error ? <Alert tone="danger" title="Plan save failed">{adminError(error)}</Alert> : null}
    {!editing ? <Field label="Code" htmlFor="plan-code" required help="Stable lowercase identifier; cannot be changed after creation."><Input id="plan-code" value={code} onChange={(event) => setCode(event.target.value)} required /></Field> : null}
    <div className="commerce-form-grid"><Field label="Name" htmlFor="plan-name" required><Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} required /></Field><Field label="Currency" htmlFor="plan-currency" required><Input id="plan-currency" maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value)} required /></Field><Field label="Monthly price · cents" htmlFor="plan-price" required><Input id="plan-price" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required /></Field><Field label="Display order" htmlFor="plan-order" required><Input id="plan-order" type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(event.target.value)} required /></Field></div>
    <Field label="Description" htmlFor="plan-description"><Textarea id="plan-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
    <div className="commerce-inline-controls"><Switch checked={isPublic} onCheckedChange={setIsPublic} label="Public pricing plan" /><Field label="Status" htmlFor="plan-status"><Select id="plan-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived")}><option value="active">Active</option><option value="archived">Archived</option></Select></Field></div>
    <fieldset className="commerce-periods"><legend>Billing periods</legend>{billingPeriods.map((period) => <Checkbox key={period} checked={periods.has(period)} onCheckedChange={(checked) => togglePeriod(period, checked)} label={period} />)}</fieldset>
    <div className="commerce-quota-grid"><Field label="Links" htmlFor="quota-links"><Input id="quota-links" type="number" min="1" value={links} onChange={(event) => setLinks(event.target.value)} /></Field><Field label="QR" htmlFor="quota-qr"><Input id="quota-qr" type="number" min="1" value={qr} onChange={(event) => setQR(event.target.value)} /></Field><Field label="Text" htmlFor="quota-text"><Input id="quota-text" type="number" min="1" value={text} onChange={(event) => setText(event.target.value)} /></Field><Field label="Bio" htmlFor="quota-bio"><Input id="quota-bio" type="number" min="1" value={bio} onChange={(event) => setBio(event.target.value)} /></Field><Field label="Storage bytes" htmlFor="quota-storage"><Input id="quota-storage" type="number" min="1" value={storage} onChange={(event) => setStorage(event.target.value)} /></Field><Field label="Members" htmlFor="quota-members"><Input id="quota-members" type="number" min="1" value={members} onChange={(event) => setMembers(event.target.value)} /></Field><Field label="Analytics retention days" htmlFor="quota-retention"><Input id="quota-retention" type="number" min="1" value={retention} onChange={(event) => setRetention(event.target.value)} /></Field></div>
    <Field label="Features · one per line" htmlFor="plan-features"><Textarea id="plan-features" rows={5} value={features} onChange={(event) => setFeatures(event.target.value)} /></Field>
    <Button type="submit" loading={busy}>{editing ? "Save plan" : "Create plan"}</Button>
  </form>;
}
