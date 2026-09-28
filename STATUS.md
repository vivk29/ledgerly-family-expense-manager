# Ledgerly Feature Status

> **Review baseline:** `1a64a38af1641a026bfe2b46d1fda0015a293584` (main, 28 Sep 2026)
>
> This file is SHA-pinned. A feature status is valid only for the baseline SHA recorded above. Update this file in every feature PR that changes a listed area.

| Feature | Status | Notes |
|---|---|---|
| GST / non-GST tagging | partial | GST treatment/rate/amount are present; broader GST workflow is not a full tax module. |
| Category edit/archive/restore | done | Category rename and archive/restore controls are present. |
| CSV export | done | Expense CSV export is present. |
| Payment-mode analytics | done | Payment method mix is present in Analysis. |
| EMI management | partial | `emi_payments` exists and payments can be recorded; amortisation/schedule engine is not complete. |
| Recurring income | partial | `income_schedules` exists; automatic transaction generation is not complete. |
| Recurring expenses | partial | Recurring records exist; scheduler and duplicate-period guard are not complete. |
| Full reports / export | partial | Basic Analysis and CSV export exist; a full reporting/export suite is not complete. |
| FY / salary-cycle reporting | partial | Monthly analysis exists; April–March and salary-cycle reporting is not complete. |
| Offline / local-first | missing | No offline-first data/cache/sync layer is implemented. |
| Advanced family roles (Owner/Member/Viewer) | missing | Family ownership exists, but a complete role/permission model is not implemented. |
| AI insights | missing | No production AI insights/recommendation layer is implemented. |
| Budget alerts | missing | In-app budget warnings exist, but notification-based budget alerts are not implemented. |
| General notifications | missing | No general notification delivery system is implemented. |
| App lock / PIN / biometric | missing | No client app-lock or biometric gate is implemented. |
| Android / AAB | missing | No Android release artifact/build pipeline is maintained. |
| Play Store package/release | missing | No Play Store release setup is complete. |
| Authenticated browser E2E | missing | No Playwright suite with dedicated test users is in place. |
| Production verification | unverifiable | Code deployment can be checked, but full authenticated production E2E has not been completed. |
| Migration-history reconciliation | unverifiable | Live DB history and repository migrations still need a controlled reconciliation review. |
| Leaked-password protection | unverifiable | Supabase Free plan currently prevents enabling this Auth feature through the available project configuration. |

## Review rule

1. Start with the pinned SHA and compare it to the target branch.
2. Inspect the actual code/schema before changing a status.
3. Do not infer live Supabase state from Git history.
4. Do not write a migration from this table alone. Pull the live schema first.
5. Update this file in the same PR whenever a listed feature changes.

## Verification boundary

- **Repository evidence:** this file's baseline SHA and code markers.
- **Live Supabase evidence:** must be checked separately and dated.
- **Vercel evidence:** must be checked separately by deployment SHA/state.
