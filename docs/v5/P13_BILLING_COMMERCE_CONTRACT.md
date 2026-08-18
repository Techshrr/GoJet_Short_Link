# GoJet V5 P13 — Billing / Payments / FX Contract

## Scope

P13 closes the frozen V5 commerce surfaces with real server authority. It includes Workspace Billing and the Admin Commerce subset (`Plans`, `Billing`, `Payments`, `FX`). It does not take ownership of the remaining P17 Admin domains.

## Workspace Billing

Route: `/app/billing`

- Current subscription and cancellation-at-period-end state.
- Real quota usage for Links, QR, Text, Bio, file bytes and members, plus analytics retention.
- Public/selectable plans from the same plan source as public pricing.
- Billing periods: monthly, quarterly, semiannual and annual.
- Orders/invoices with original amount/currency and settlement amount/currency.
- Frozen invoice FX snapshot: rate, provider, markup and quoted time.
- Enabled payment channels from the server.
- Checkout initiation may return redirect or QR instructions but MUST NOT mark an invoice paid optimistically.
- Invoice payment truth remains server-side and changes only after verified provider callback or audited administrator settlement.
- Owner/Admin may create invoices, pay and change renewal state. Read-only roles do not receive commerce write actions.

## Managed plans

Admin route: `/admin/plans`

The persistent plan contract includes:

- stable code;
- name and description;
- currency and monthly base price;
- public/private state;
- display order;
- allowed billing periods;
- status/archive lifecycle;
- feature list;
- link, QR, Text, Bio, file-storage and member quotas;
- analytics retention days.

`GET /api/public/plans` reads active public plans ordered by `display_order`; Workspace Billing uses the same public plan source. The existing billing lifecycle remains authoritative for invoice pricing.

## Admin Billing

Route: `/admin/billing`

- Invoice list and status filter.
- Original and settlement/FX snapshots shown together.
- Manual `paid` / `void` settlement is explicitly an audited override.
- The billing service blocks manual settlement while an active provider payment is in progress.

## Admin Payments

Route: `/admin/payments`

- Transaction order, workspace/owner, amount/currency, provider, provider reference, state and timestamps.
- Detail timeline is sourced from `payment_callback_events`.
- Callback presentation exposes request/provider references, payload SHA-256, result, response status, remote IP and time.
- Raw `provider_payload`, checkout secrets and provider credentials MUST NOT be returned by the Admin Payments presentation API or rendered by the UI.

## Admin FX

Route: `/admin/fx`

- Settlement currency.
- FX provider (`ecb` or `manual`).
- Markup basis points and cache duration.
- Manual USD/XXX rates.
- Current cache observations and expiry.
- Historical FX snapshots from invoices.
- Every configuration override requires a non-empty 1–500 character reason.
- Saving an override clears `fx_rate_cache` and writes `admin.fx_updated` into the existing administrator audit log contract.

## Persistent schema

P13 adds managed-plan presentation fields to `plans`:

- `is_public`
- `display_order`
- `billing_periods`

Existing plans are migrated to public with all four supported periods and deterministic display order.

## Fixed Browser Gate

Required viewports:

- 1440×900
- 1024×768
- 390×844

Hard failures include horizontal overflow, console/page errors, clipped commerce controls, optimistic paid state, exposed raw callback payload, missing mandatory FX reason, and Admin commerce routes not protected by `billing.manage`.

## Completion rule

P13 is DONE only when:

1. P01–P12 regressions remain green.
2. P13 contract verifier passes.
3. strict TypeScript and all frontend builds pass.
4. billing/payments/platform API Go tests pass.
5. Workspace Billing and all four Admin Commerce pages pass fixed-viewport Browser Gate.
6. the tested SHA is the exact current V5 branch HEAD.
7. `Plans / quotas`, `Billing`, `Orders / invoices`, `Payment channels / callbacks`, and `FX / rate history / override` are moved to DONE only after successful exact-head evidence.
