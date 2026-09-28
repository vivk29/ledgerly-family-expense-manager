alter table public.expenses
  add column if not exists gst_treatment text not null default 'non_gst'
    check (gst_treatment in ('non_gst','gst')),
  add column if not exists gst_rate numeric(5,2),
  add column if not exists gst_amount numeric(14,2);

alter table public.expenses
  drop constraint if exists expenses_gst_rate_check;
alter table public.expenses
  add constraint expenses_gst_rate_check
  check (gst_rate is null or (gst_rate >= 0 and gst_rate <= 100));

alter table public.expenses
  drop constraint if exists expenses_gst_amount_check;
alter table public.expenses
  add constraint expenses_gst_amount_check
  check (gst_amount is null or gst_amount >= 0);

create table if not exists public.emi_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  emi_id uuid not null references public.emis(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  principal_amount numeric(14,2),
  interest_amount numeric(14,2),
  payment_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.emi_payments enable row level security;
drop policy if exists emi_payments_select on public.emi_payments;
drop policy if exists emi_payments_insert on public.emi_payments;
create policy emi_payments_select on public.emi_payments
  for select to authenticated
  using ((select private.is_family_member(family_id)));
create policy emi_payments_insert on public.emi_payments
  for insert to authenticated
  with check ((select private.is_family_member(family_id)));
create index if not exists emi_payments_emi_id_idx on public.emi_payments(emi_id);
create index if not exists emi_payments_family_id_idx on public.emi_payments(family_id);

create table if not exists public.income_schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  frequency text not null default 'monthly'
    check (frequency in ('weekly','monthly','yearly')),
  start_date date not null default current_date,
  end_date date,
  next_due_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.income_schedules enable row level security;
drop policy if exists income_schedules_select on public.income_schedules;
drop policy if exists income_schedules_insert on public.income_schedules;
drop policy if exists income_schedules_update on public.income_schedules;
drop policy if exists income_schedules_delete on public.income_schedules;
create policy income_schedules_select on public.income_schedules
  for select to authenticated
  using ((select private.is_family_member(family_id)));
create policy income_schedules_insert on public.income_schedules
  for insert to authenticated
  with check ((select private.is_family_member(family_id)));
create policy income_schedules_update on public.income_schedules
  for update to authenticated
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));
create policy income_schedules_delete on public.income_schedules
  for delete to authenticated
  using ((select private.is_family_member(family_id)));
create index if not exists income_schedules_family_id_idx on public.income_schedules(family_id);
create index if not exists income_schedules_next_due_idx on public.income_schedules(next_due_date);