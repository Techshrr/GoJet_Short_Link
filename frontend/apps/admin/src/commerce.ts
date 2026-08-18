import { api } from "@gojet/auth";
import { createBillingClient } from "@gojet/api-client";

export const commerceClient = createBillingClient(api);

export function adminMoney(cents: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${currency}`; }
}

export function adminDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function adminError(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export const billingPeriods = ["monthly", "quarterly", "semiannual", "annual"] as const;
