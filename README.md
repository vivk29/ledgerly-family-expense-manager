# Ledgerly — Family Expense Manager

Ledgerly is a shared family/household expense tracker: who paid, who's responsible, who owes whom, plus income, budgets, recurring/fixed expenses, EMIs, transfers, family loans, and receipts.

## Architecture

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript (strict mode).
- **Backend:** Supabase (Postgres + Auth + Storage), accessed directly from the client via the anon/publishable key. Access control is enforced by **Row Level Security (RLS)**.
- **Auth:** Supabase magic-link email authentication.
- **Styling:** Hand-written CSS with theme tokens in `app/globals.css`.

## Repository structure

```
app/
  page.tsx
  advanced/
  layout.tsx
  globals.css
lib/
  supabaseClient.ts
  money.ts
  split.ts
  settlement.ts
  validators.ts
supabase/
  base_schema.sql
  001_complete_ledgerly.sql
  002_financial_integrity.sql
  003_fix_family_code_crypto_schema.sql
  004_add_split_mode.sql
tests/
  money.test.ts
  split.test.ts
  settlement.test.ts
  validators.test.ts
```

### Supabase schema note

The original Ledgerly database had a base schema that predates the numbered migration history. That schema is now captured in **`supabase/base_schema.sql`**, together with the private `ledgerly-receipts` Storage bucket and its family-scoped Storage policies.

`base_schema.sql` is deliberately a **bootstrap/reference SQL file, not a timestamped Supabase migration**. This avoids pretending that the existing production migration history contains a baseline migration that it does not. On a brand-new environment, apply the bootstrap first, then apply the numbered migrations in order.

**Do not run `base_schema.sql` against the existing production project.** The live project already contains the schema.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Environment variables

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API | Public client URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API | Anon/publishable key; never use a service-role/secret key here |

If these are unset, `lib/supabaseClient.ts` uses placeholder values so the production build can complete in CI. The app cannot access a real database until valid values are configured.

## Supabase setup for a fresh environment

1. Create a Supabase project.
2. Apply `supabase/base_schema.sql`.
3. Apply the migrations in order:
   ```
   001_complete_ledgerly.sql
   002_financial_integrity.sql
   003_fix_family_code_crypto_schema.sql
   004_add_split_mode.sql
   ```
4. Confirm the `ledgerly-receipts` bucket is private and that its family-scoped Storage policies exist. The bootstrap file creates these.
5. Configure the magic-link redirect URL allow-list for localhost, preview, and production origins.

The live Ledgerly project currently has additional migration history beyond these four repository migrations. That production drift must be reconciled separately before claiming the repository is a complete migration-history clone.

## Testing

```bash
npm test
npx tsc --noEmit
npm run build
```

The unit tests are intended to run against the actual production calculation modules, covering:

- INR currency formatting.
- Single/equal/custom/percentage split allocation.
- Paisa-exact rounding.
- Invalid split totals.
- Settlement minimization.
- Payment validation including over/under-payment cases.
- Transfer/loan same-member rejection.

There is currently no automated authenticated browser/E2E suite.

## CI

`.github/workflows/ledgerly-ci.yml` is intended to run dependency installation, TypeScript validation, tests, and the production build for pull requests and pushes.

Before merging this hardening branch, verify that the corresponding CI changes and test files are actually present on the GitHub branch. The current `main` branch was inspected separately and still reflects the older 15-file inventory.

## Deployment

Ledgerly is deployed through Vercel. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for each required environment.

Always verify the production deployment's commit SHA directly before assuming production matches `main`.

## Security notes

- Client-side code must never contain a Supabase service-role/secret key.
- RLS is enabled on the Ledgerly public tables.
- `create_family()`, `join_family()`, and `is_family_member()` are SECURITY DEFINER functions and use explicit search paths/schema qualification.
- Receipt storage is private and family-scoped.
- The current live project still requires a focused review of SECURITY DEFINER execution grants and Auth leaked-password protection before release.

## Current known gaps

- **Live migration history differs from repository history.** The live project contains additional migrations not yet represented as numbered files in this repository.
- **Security hardening remains.** Supabase currently reports SECURITY DEFINER execution warnings for `create_family`, `join_family`, and `is_family_member`, plus disabled leaked-password protection. These require deliberate remediation/testing rather than blindly suppressing the warnings.
- **No automated authenticated E2E suite.**
- **No Android project/AAB.**
- **No Privacy Policy, Data Safety declaration, or Play Store listing assets.**
- **Production/Vercel commit alignment still requires live verification.**

## Release process

1. Work from a dedicated Ledgerly branch.
2. Keep `npm test`, `npx tsc --noEmit`, and `npm run build` passing.
3. Review and test Supabase schema/RLS/security changes.
4. Test critical authenticated flows on a Vercel Preview.
5. Verify the production deployment SHA matches the tested source.
6. Complete Android/Play Store requirements separately.

**Important:** The Ledgerly hardening work must not modify or interact with the separate AI Trading project.
