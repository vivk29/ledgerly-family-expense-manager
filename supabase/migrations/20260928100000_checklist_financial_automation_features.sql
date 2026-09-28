-- Ledgerly checklist financial automation and role metadata.
alter table public.family_members
  add column if not exists role text not null default 'member';
alter table public.family_members
  drop constraint if exists family_members_role_check;
alter table public.family_members
  add constraint family_members_role_check check (role in ('owner','member','viewer'));
update public.family_members fm
set role='owner'
from public.families f
where f.id=fm.family_id and f.created_by=fm.user_id;

create table if not exists public.income_schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  member_id uuid references public.family_members(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  due_day smallint not null check (due_day between 1 and 31),
  is_active boolean not null default true,
  last_generated_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expense_runs (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references public.recurring_expenses(id) on delete cascade,
  period_month date not null,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(recurring_expense_id, period_month)
);

create table if not exists public.income_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  income_schedule_id uuid not null references public.income_schedules(id) on delete cascade,
  period_month date not null,
  income_id uuid references public.incomes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(income_schedule_id, period_month)
);

create table if not exists public.emi_payments (
  id uuid primary key default gen_random_uuid(),
  emi_id uuid not null references public.emis(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  principal_amount numeric(14,2),
  interest_amount numeric(14,2),
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.income_schedules enable row level security;
alter table public.recurring_expense_runs enable row level security;
alter table public.income_schedule_runs enable row level security;
alter table public.emi_payments enable row level security;

drop policy if exists income_schedules_all on public.income_schedules;
create policy income_schedules_all on public.income_schedules for all to authenticated
using ((select private.is_family_member(family_id)))
with check ((select private.is_family_member(family_id)));

drop policy if exists recurring_expense_runs_all on public.recurring_expense_runs;
create policy recurring_expense_runs_all on public.recurring_expense_runs for all to authenticated
using (exists (select 1 from public.recurring_expenses r where r.id=recurring_expense_id and (select private.is_family_member(r.family_id))))
with check (exists (select 1 from public.recurring_expenses r where r.id=recurring_expense_id and (select private.is_family_member(r.family_id))));

drop policy if exists income_schedule_runs_all on public.income_schedule_runs;
create policy income_schedule_runs_all on public.income_schedule_runs for all to authenticated
using (exists (select 1 from public.income_schedules s where s.id=income_schedule_id and (select private.is_family_member(s.family_id))))
with check (exists (select 1 from public.income_schedules s where s.id=income_schedule_id and (select private.is_family_member(s.family_id))));

drop policy if exists emi_payments_all on public.emi_payments;
create policy emi_payments_all on public.emi_payments for all to authenticated
using (exists (select 1 from public.emis e where e.id=emi_id and (select private.is_family_member(e.family_id))))
with check (exists (select 1 from public.emis e where e.id=emi_id and (select private.is_family_member(e.family_id))));

create index if not exists income_schedules_family_idx on public.income_schedules(family_id,is_active);
create index if not exists emi_payments_emi_idx on public.emi_payments(emi_id,payment_date desc);
create index if not exists recurring_expense_runs_period_idx on public.recurring_expense_runs(period_month);
create index if not exists income_schedule_runs_period_idx on public.income_schedule_runs(period_month);
