# Exact HEAD final candidate contract

This Markdown file is deliberately stored beside the migration catalog so changes to release-candidate policy exercise every migration-sensitive gate. It is documentation only and must never be listed in `migrationcatalog.txt`; only `.sql` files are executable migrations.

A candidate is eligible for real aaPanel installation only when the current branch HEAD itself passes Authentication Policy, Installer Validation, Full-stack P0, Product Surface, Database Schema Naming, Analytics Dashboard, both payment callback gates, and Release Package. The Release workflow must also pass its same-run Fresh Install Candidate against the exact archive produced by that HEAD.

The 2026-08-15 reconciliation additionally requires customer-only social login: administrator authentication remains independent email/password plus its existing MFA controls; Google, Facebook, GitHub, QQ, WeChat and Rainbow providers are customer registration/login/binding integrations configured through the customer quick-login settings surface. The focused customer login, registration, recovery and verification pages and their browser contracts are part of the same candidate.

Any later commit invalidates the candidate and requires the complete exact-HEAD evidence set again.
