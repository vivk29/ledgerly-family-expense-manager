-- Ledgerly bootstrap schema
-- Purpose: reproduce the pre-001 base schema that the incremental Ledgerly migrations
-- expect, plus the private receipt bucket and its Storage policies.
--
-- This is intentionally NOT a timestamped Supabase migration. It is a bootstrap
-- reference for fresh environments because the original base schema predates the
-- migration history currently committed in this repository.
--
-- Apply this file first to an empty Supabase project, then apply:
--   001_complete_ledgerly.sql
--   002_financial_integrity.sql
--   003_fix_family_code_crypto_schema.sql
--   004_add_split_mode.sql
--
-- Do not run this file against the existing production database: it already has
-- this schema and its migration history.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  family_code text,
  join_pin_hash text
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  income_monthly numeric(14,2) not null default 0,
  budget_monthly numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  invited_at timestamptz
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  created_at timestamptz not null default now(),
  unique (family_id, name, kind)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null default current_date,
  expense_type text not null default 'variable'
    check (expense_type in ('fixed','emi','variable')),
  payment_method text,
  notes text,
  receipt_path text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  percentage numeric(7,3),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

create table if not exists public.expense_payers (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  income_date date not null default current_date,
  notes text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.emis (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete set null,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_day smallint check (due_day between 1 and 31),
  remaining_amount numeric(14,2),
  total_installments integer,
  remaining_installments integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  payer_member_id uuid references public.family_members(id) on delete set null,
  due_day smallint check (due_day between 1 and 31),
  expense_type text not null default 'fixed'
    check (expense_type in ('fixed','emi','variable')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  from_member_id uuid not null references public.family_members(id) on delete cascade,
  to_member_id uuid not null references public.family_members(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','partial','paid','reversed')),
  paid_amount numeric(14,2) not null default 0
    check (paid_amount >= 0 and paid_amount <= amount),
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  member_id uuid references public.family_members(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (family_id, member_id, category_id, month)
);

create or replace function public.is_family_member(target_family uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = target_family
      and fm.user_id = auth.uid()
      and fm.is_active
  ) or exists (
    select 1 from public.families f
    where f.id = target_family
      and f.created_by = auth.uid()
  );
$function$;

create or replace function public.create_family(p_name text, p_pin text)
returns table(family_id uuid, family_name text, family_code text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_family uuid;
  v_code text;
  v_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(length(trim(p_name)),0) < 2 then
    raise exception 'Family name is required';
  end if;
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'Family PIN must be 4 to 6 digits';
  end if;

  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8));
    exit when not exists (
      select 1 from public.families f where f.family_code = v_code
    );
  end loop;

  v_name := trim(p_name);

  insert into public.families(name,created_by,family_code,join_pin_hash)
  values(
    v_name,
    (select auth.uid()),
    v_code,
    extensions.crypt(p_pin,extensions.gen_salt('bf'))
  )
  returning id into v_family;

  insert into public.family_members(family_id,user_id,name,email,is_active)
  values(
    v_family,
    (select auth.uid()),
    coalesce(
      split_part(
        (select email from auth.users where id=(select auth.uid())),
        '@',
        1
      ),
      'Owner'
    ),
    (select email from auth.users where id=(select auth.uid())),
    true
  );

  insert into public.categories(family_id,name,kind) values
    (v_family,'Food & Groceries','expense'),
    (v_family,'Housing & Rent','expense'),
    (v_family,'Utilities','expense'),
    (v_family,'Transport','expense'),
    (v_family,'Education','expense'),
    (v_family,'Medical & Health','expense'),
    (v_family,'Shopping','expense'),
    (v_family,'Entertainment','expense'),
    (v_family,'Insurance','expense'),
    (v_family,'Personal Care','expense'),
    (v_family,'Family & Kids','expense'),
    (v_family,'Subscriptions','expense'),
    (v_family,'Other','expense'),
    (v_family,'Salary','income'),
    (v_family,'Business','income'),
    (v_family,'Interest','income'),
    (v_family,'Other Income','income');

  return query select v_family,v_name,v_code;
end;
$function$;

create or replace function public.join_family(p_code text, p_pin text, p_name text)
returns table(family_id uuid, family_name text, family_code text, member_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_family public.families%rowtype;
  v_member uuid;
  v_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in';
  end if;

  select * into v_family
  from public.families f
  where upper(f.family_code) = upper(trim(p_code))
  limit 1;

  if v_family.id is null then
    raise exception 'Family code not found';
  end if;

  if extensions.crypt(p_pin, v_family.join_pin_hash) <> v_family.join_pin_hash then
    raise exception 'Verification PIN is incorrect';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = (select auth.uid());

  select fm.id into v_member
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.user_id = (select auth.uid())
  limit 1;

  if v_member is null then
    insert into public.family_members(family_id,user_id,name,email,is_active)
    values(
      v_family.id,
      (select auth.uid()),
      coalesce(
        nullif(trim(p_name),''),
        split_part(coalesce(v_email,'Member'),'@',1)
      ),
      v_email,
      true
    )
    returning id into v_member;
  else
    update public.family_members fm
    set name = coalesce(nullif(trim(p_name),''), fm.name),
        email = v_email,
        is_active = true
    where fm.id = v_member;
  end if;

  return query
    select v_family.id,v_family.name,v_family.family_code,v_member;
end;
$function$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_allocations enable row level security;
alter table public.expense_payers enable row level security;
alter table public.incomes enable row level security;
alter table public.emis enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.settlements enable row level security;
alter table public.budgets enable row level security;

drop policy if exists families_select on public.families;
drop policy if exists families_insert on public.families;
drop policy if exists families_update on public.families;
drop policy if exists families_delete on public.families;
create policy families_select on public.families
  for select to public using (public.is_family_member(id));
create policy families_insert on public.families
  for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy families_update on public.families
  for update to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
create policy families_delete on public.families
  for delete to authenticated
  using ((select auth.uid()) = created_by);

drop policy if exists family_members_all on public.family_members;
create policy family_members_all on public.family_members
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists expenses_all on public.expenses;
create policy expenses_all on public.expenses
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists allocations_all on public.expense_allocations;
create policy allocations_all on public.expense_allocations
  for all to public
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and public.is_family_member(e.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_allocations.expense_id
        and public.is_family_member(e.family_id)
    )
  );

drop policy if exists payers_all on public.expense_payers;
create policy payers_all on public.expense_payers
  for all to public
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_payers.expense_id
        and public.is_family_member(e.family_id)
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_payers.expense_id
        and public.is_family_member(e.family_id)
    )
  );

drop policy if exists incomes_all on public.incomes;
create policy incomes_all on public.incomes
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists emis_all on public.emis;
create policy emis_all on public.emis
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists recurring_all on public.recurring_expenses;
create policy recurring_all on public.recurring_expenses
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists settlements_all on public.settlements;
create policy settlements_all on public.settlements
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

drop policy if exists budgets_all on public.budgets;
create policy budgets_all on public.budgets
  for all to public
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create index if not exists families_created_by_idx on public.families(created_by);
create unique index if not exists families_family_code_uidx
  on public.families(family_code) where family_code is not null;
create index if not exists family_members_family_id_idx on public.family_members(family_id);
create index if not exists family_members_user_id_idx on public.family_members(user_id);
create unique index if not exists family_members_family_email_lower_uidx
  on public.family_members(family_id, lower(trim(email)))
  where email is not null and trim(email) <> '';
create unique index if not exists categories_family_id_name_kind_key
  on public.categories(family_id,name,kind);
create index if not exists expenses_family_date_idx on public.expenses(family_id,expense_date desc);
create index if not exists expenses_category_id_idx on public.expenses(category_id);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists expense_allocations_member_idx on public.expense_allocations(member_id);
create index if not exists expense_payers_member_idx on public.expense_payers(member_id);
create index if not exists incomes_family_date_idx on public.incomes(family_id,income_date desc);
create index if not exists incomes_category_id_idx on public.incomes(category_id);
create index if not exists incomes_created_by_idx on public.incomes(created_by);
create index if not exists incomes_member_id_idx on public.incomes(member_id);
create index if not exists emis_family_id_idx on public.emis(family_id);
create index if not exists emis_member_id_idx on public.emis(member_id);
create index if not exists recurring_expenses_category_id_idx on public.recurring_expenses(category_id);
create index if not exists recurring_expenses_family_id_idx on public.recurring_expenses(family_id);
create index if not exists recurring_expenses_payer_member_id_idx on public.recurring_expenses(payer_member_id);
create index if not exists settlements_from_member_id_idx on public.settlements(from_member_id);
create index if not exists settlements_to_member_id_idx on public.settlements(to_member_id);

insert into storage.buckets (id,name,public)
values ('ledgerly-receipts','ledgerly-receipts',false)
on conflict (id) do update set public = excluded.public;

drop policy if exists ledgerly_receipts_insert on storage.objects;
drop policy if exists ledgerly_receipts_select on storage.objects;
create policy ledgerly_receipts_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ledgerly-receipts'
  and public.is_family_member(((storage.foldername(name))[1])::uuid)
);
create policy ledgerly_receipts_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'ledgerly-receipts'
  and public.is_family_member(((storage.foldername(name))[1])::uuid)
);
