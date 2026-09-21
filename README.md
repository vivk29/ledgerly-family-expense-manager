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
  security_hardening.sql
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

## Supabase schema and bootstrap

The original Ledgerly database had a base schema that predates the numbered migration history. That schema is now captured in **`supabase/base_schema.sql`**, together with the private `ledgerly-receipts` Storage bucket and its family-scoped Storage policies.

`base_schema.sql` is deliberately a **bootstrap/reference SQL file, not a timestamped Supabase migration**. This avoids pretending that the existing production migration history contains a baseline migration that it does not.

For a brand-new environment:

1. Apply `supabase/base_schema.sql`.
2. Apply the numbered repository migrations in order:
   ```
   001_complete_ledgerly.sql
   002_financial_integrity.sql
   003_fix_family_code_crypto_schema.sql
   004_add_split_mode.sql
   ```
3. Apply `supabase/security_hardening.sql`.
4. Verify the resulting schema, RLS policies, Storage policies and Security Advisors.

**Do not run `base_schema.sql` against the existing production project.** The live project already contains the schema.

The live Ledgerly project currently has additional migration history beyond these four repository migrations. That production drift must be reconciled separately before claiming the repository is a complete migration-history clone.

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

## Testing

```bash
npm test
npx tsc --noEmit
npm run build
```

The intended unit tests cover the actual production calculation modules:

- INR currency formatting.
- Single/equal/custom/percentage split allocation.
- Paisa-exact rounding.
- Invalid split totals.
- Settlement minimization.
- Payment validation including over/under-payment cases.
- Transfer/loan same-member rejection.

There is currently no automated authenticated browser/E2E suite.

## CI

The intended CI pipeline runs dependency installation, TypeScript validation, tests, and the production build for pull requests and pushes.

**Important repository-state finding:** the current `main` branch was inspected independently and still contains the older 15-file inventory. The extracted `lib/` modules, tests, lockfile and CI changes described in the uploaded hardening README are therefore not yet confirmed as committed to `main`. This hardening branch should not be merged until those source changes are actually present and verified.

## Deployment

Ledgerly is deployed through Vercel. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for each required environment.

Always verify the production deployment's commit SHA directly before assuming production matches `main`.

## Security hardening completed on the live Supabase project

The live project was inspected before making changes.

The RLS helper `public.is_family_member(uuid)` was moved to the non-exposed `private` schema. All Ledgerly RLS and receipt Storage policies now call `private.is_family_member(...)`, and the public helper was removed.

The `create_family()` and `join_family()` SECURITY DEFINER RPCs remain in `public` because the client intentionally calls them to create/join families. Their execution was restricted away from `public`/anon and explicitly granted to `authenticated`.

Supabase Security Advisors were re-run after the change. The exposed SECURITY DEFINER warning for `is_family_member` disappeared. The remaining SECURITY DEFINER warnings are only for the two intentionally client-callable family RPCs.

The other remaining Security Advisor warning is **Leaked Password Protection disabled**. Ledgerly uses magic-link authentication, but this setting should still be reviewed in the Supabase Auth dashboard if password authentication is enabled for the project.

## Current known gaps

- **Live migration history differs from repository history.** The live project contains additional migrations not yet represented as numbered files in this repository.
- **Two intentional SECURITY DEFINER RPC warnings remain** for `create_family` and `join_family`. Their bodies validate `auth.uid()`, use an isolated search path, and execution is restricted to authenticated users.
- **Leaked Password Protection remains disabled** in Supabase Auth and requires dashboard configuration/verification.
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
