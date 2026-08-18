import type { ApiTransport } from "./links";

export interface BillingPlan {
  id: number; code: string; name: string; monthly_price_cents: number; currency: string; description: string; status: "active" | "archived";
  features: unknown; link_limit: number; qr_limit: number; text_limit: number; bio_limit: number; file_storage_bytes: number; member_limit: number; analytics_retention_days: number;
}
export interface BillingSubscription { workspace_id: number; plan_id: number; plan_code: string; plan_name: string; status: string; period_started_at: string; period_ends_at?: string; cancel_at_period_end: boolean; }
export interface BillingUsage { plan_name: string; plan_code: string; links: number; link_limit: number; qr_codes: number; qr_limit: number; text_shares: number; text_limit: number; bio_pages: number; bio_limit: number; file_bytes: number; file_storage_bytes: number; members: number; member_limit: number; analytics_retention_days: number; }
export interface BillingInvoice { id: number; workspace_id: number; plan_id: number; requested_by: number; source_amount_cents: number; amount_cents: number; fx_markup_bps: number; period_months: number; period_days: number; invoice_number: string; plan_name: string; plan_code: string; invoice_type: string; billing_cycle: string; source_currency: string; currency: string; fx_rate: string; fx_provider: string; fx_quoted_at?: string; status: "pending" | "overdue" | "paid" | "void" | string; due_at: string; paid_at?: string; admin_note?: string; created_at: string; }
export interface WorkspaceBillingPayload { plans: BillingPlan[]; subscription: BillingSubscription; usage: BillingUsage; invoices: BillingInvoice[]; }
export interface PaymentMethod { code: string; name: string; enabled: boolean; mode: string; }
export interface PaymentCheckout { transaction_id: number; provider: string; provider_name: string; mode: string; redirect_url?: string; qr_content?: string; merchant_order_no: string; reused?: boolean; }
export interface AdminPayment { id: number; invoice_id: number; workspace_id: number; owner_email: string; provider: string; merchant_order_no: string; provider_order_id: string; amount_cents: number; currency: string; status: string; failure_reason?: string; paid_at?: string; created_at: string; updated_at: string; }
export interface PaymentCallback { id: number; provider: string; request_id: string; merchant_order_no: string; provider_reference: string; payload_sha256: string; outcome: "accepted" | "rejected"; response_status: number; remote_ip: string; created_at: string; }
export interface AdminPaymentDetail { payment: AdminPayment; callbacks: PaymentCallback[]; payload_redacted: true; }
export interface FXRate { base_currency: string; quote_currency: string; provider: string; rate: string; observed_at: string; expires_at: string; }
export interface FXHistory { invoice_number: string; source_currency: string; currency: string; rate: string; provider: string; markup_bps: number; quoted_at?: string; created_at: string; }
export interface AdminFXPayload { settlement_currency: string; provider: "ecb" | "manual"; markup_bps: number; cache_hours: number; manual_rates: Record<string,string>; rates: FXRate[]; history: FXHistory[]; }
export interface PlanWriteInput { name: string; description: string; status?: "active" | "archived"; monthly_price_cents: number; link_limit: number; qr_limit: number; text_limit: number; bio_limit: number; file_storage_bytes: number; member_limit: number; analytics_retention_days: number; features: unknown; }
export interface PlanCreateInput extends PlanWriteInput { code: string; currency: string; }

export function createBillingClient(api: ApiTransport) {
  return {
    workspace: (workspaceId: number) => api.get<WorkspaceBillingPayload>(`/api/workspaces/${workspaceId}/billing`),
    paymentMethods: (workspaceId: number) => api.get<{data: PaymentMethod[]}>(`/api/workspaces/${workspaceId}/billing/payment-methods`),
    createInvoice: (workspaceId: number, planCode: string, type: "change" | "renew", billingCycle: string) => api.post<BillingInvoice>(`/api/workspaces/${workspaceId}/billing/invoices`, { plan_code: planCode, type, billing_cycle: billingCycle }),
    cancellation: (workspaceId: number, cancel: boolean) => api.patch<{cancel_at_period_end: boolean}>(`/api/workspaces/${workspaceId}/billing/cancellation`, { cancel }),
    checkout: (workspaceId: number, invoiceId: number, provider: string) => api.post<PaymentCheckout>(`/api/workspaces/${workspaceId}/billing/invoices/${invoiceId}/pay`, { provider }),
    adminPlans: () => api.get<{data: BillingPlan[]}>("/api/admin/plans"),
    createPlan: (input: PlanCreateInput) => api.post<{id: number; created: boolean}>("/api/admin/plans", input),
    updatePlan: (planId: number, input: PlanWriteInput) => api.put<{updated: boolean}>(`/api/admin/plans/${planId}`, input),
    archivePlan: (planId: number) => api.post<{archived: boolean}>(`/api/admin/plans/${planId}/archive`),
    adminInvoices: (status = "") => api.get<{data: BillingInvoice[]}>(`/api/admin/invoices${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    settleInvoice: (invoiceId: number, status: "paid" | "void", note: string) => api.post<{updated: boolean}>(`/api/admin/invoices/${invoiceId}/settle`, { status, note }),
    adminPayments: (status = "", provider = "") => api.get<{data: AdminPayment[]}>(`/api/admin/payments?status=${encodeURIComponent(status)}&provider=${encodeURIComponent(provider)}`),
    adminPayment: (paymentId: number) => api.get<AdminPaymentDetail>(`/api/admin/payments/${paymentId}`),
    adminFX: () => api.get<AdminFXPayload>("/api/admin/fx"),
    updateFX: (input: {settlement_currency: string; provider: "ecb" | "manual"; markup_bps: number; cache_hours: number; manual_rates: Record<string,string>; reason: string}) => api.put<{updated: boolean}>("/api/admin/fx", input)
  };
}
