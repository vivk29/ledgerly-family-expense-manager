-- Track credit-card bill status without storing any card or bank credentials.
-- Status is only used for expenses paid with a saved credit card.
alter table public.expenses
  add column if not exists card_payment_status text,
  add column if not exists card_paid_at timestamptz;

alter table public.expenses
  drop constraint if exists expenses_card_payment_status_check;

alter table public.expenses
  add constraint expenses_card_payment_status_check
  check (card_payment_status is null or card_payment_status in ('pending','pending_next_month','paid'));

-- Existing credit-card expenses become pending card liabilities.
update public.expenses
set card_payment_status = 'pending'
where payment_method = 'Credit Card'
  and payment_account_id is not null
  and card_payment_status is null;

-- Non-card expenses should never carry a card liability.
update public.expenses
set card_payment_status = null,
    card_paid_at = null
where payment_method is distinct from 'Credit Card';

create index if not exists expenses_card_payment_idx
  on public.expenses(payment_account_id, card_payment_status)
  where payment_account_id is not null;
