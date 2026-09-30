-- Payment accounts and card tracking for Ledgerly.
-- Expenses can point to a specific account/card without storing sensitive card numbers.
create table if not exists public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  account_type text not null default 'credit_card' check (account_type in ('credit_card','bank_account','cash','upi','debit_card','other')),
  name text not null,
  issuer text,
  last4 text,
  credit_limit numeric,
  statement_day integer check (statement_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists payment_accounts_family_idx on public.payment_accounts(family_id, account_type);

alter table public.expenses add column if not exists payment_account_id uuid references public.payment_accounts(id) on delete set null;
create index if not exists expenses_payment_account_idx on public.expenses(payment_account_id);

alter table public.payment_accounts enable row level security;
drop policy if exists payment_accounts_all on public.payment_accounts;
create policy payment_accounts_all on public.payment_accounts
  for all using (private.is_family_member(family_id))
  with check (private.is_family_member(family_id));
