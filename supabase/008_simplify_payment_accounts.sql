-- Simplify payment accounts to the actual Ledgerly requirement.
-- Existing installations may have legacy metadata columns from 007; remove them.
alter table public.payment_accounts
  drop constraint if exists payment_accounts_account_type_check,
  drop column if exists issuer,
  drop column if exists last4,
  drop column if exists credit_limit,
  drop column if exists statement_day,
  drop column if exists due_day,
  drop column if exists notes;

alter table public.payment_accounts
  alter column member_id set not null,
  add constraint payment_accounts_account_type_check
    check (account_type in ('credit_card','bank_account','debit_card','upi'));

-- Cash / Other are expense payment methods but are not saved payment-account types.
