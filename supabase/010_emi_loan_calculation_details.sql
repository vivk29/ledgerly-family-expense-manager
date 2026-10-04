alter table public.emis
  add column if not exists principal_amount numeric(14,2),
  add column if not exists loan_tenure_months integer,
  add column if not exists total_interest numeric(14,2),
  add column if not exists total_repayment numeric(14,2);

alter table public.emis
  drop constraint if exists emis_interest_rate_check,
  drop constraint if exists emis_loan_tenure_months_check,
  drop constraint if exists emis_principal_amount_check;

alter table public.emis
  add constraint emis_interest_rate_check check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  add constraint emis_loan_tenure_months_check check (loan_tenure_months is null or loan_tenure_months > 0),
  add constraint emis_principal_amount_check check (principal_amount is null or principal_amount > 0);

alter table public.family_loans
  add column if not exists interest_rate numeric(5,2),
  add column if not exists tenure_months integer,
  add column if not exists monthly_payment numeric(14,2),
  add column if not exists total_interest numeric(14,2),
  add column if not exists total_repayment numeric(14,2);

alter table public.family_loans
  drop constraint if exists family_loans_interest_rate_check,
  drop constraint if exists family_loans_tenure_months_check,
  drop constraint if exists family_loans_monthly_payment_check;

alter table public.family_loans
  add constraint family_loans_interest_rate_check check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 100)),
  add constraint family_loans_tenure_months_check check (tenure_months is null or tenure_months > 0),
  add constraint family_loans_monthly_payment_check check (monthly_payment is null or monthly_payment > 0);
