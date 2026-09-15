-- Ledgerly financial integrity and relationship indexes.
alter table public.settlements drop constraint if exists settlements_paid_amount_le_amount;
alter table public.settlements add constraint settlements_paid_amount_le_amount check (paid_amount <= amount);
alter table public.family_transfers drop constraint if exists family_transfers_distinct_members;
alter table public.family_transfers add constraint family_transfers_distinct_members check (from_member_id <> to_member_id);
alter table public.family_loans drop constraint if exists family_loans_distinct_members;
alter table public.family_loans add constraint family_loans_distinct_members check (from_member_id <> to_member_id);
create index if not exists expenses_family_deleted_date_idx on public.expenses(family_id,deleted_at,expense_date);
create index if not exists settlements_family_status_idx on public.settlements(family_id,status);
create index if not exists budgets_family_month_idx on public.budgets(family_id,month);
create index if not exists recurring_family_active_idx on public.recurring_expenses(family_id,is_active);
create index if not exists emis_family_active_idx on public.emis(family_id,is_active);
create index if not exists family_loans_from_member_idx on public.family_loans(from_member_id);
create index if not exists family_loans_to_member_idx on public.family_loans(to_member_id);
create index if not exists family_transfers_from_member_idx on public.family_transfers(from_member_id);
create index if not exists family_transfers_to_member_idx on public.family_transfers(to_member_id);
create or replace function public.touch_expense_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at before update on public.expenses for each row execute function public.touch_expense_updated_at();
