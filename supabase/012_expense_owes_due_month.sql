-- Optional reimbursement liabilities, separate from expense responsibility.
create table if not exists public.expense_owes (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete cascade,
  amount numeric(14,2) not null check(amount > 0),
  due_month date not null,
  status text not null default 'open' check(status in ('open','partially_paid','paid')),
  created_at timestamptz not null default now(),
  check (due_month = date_trunc('month', due_month)::date)
);
create index if not exists expense_owes_expense_idx on public.expense_owes(expense_id);
create index if not exists expense_owes_member_due_idx on public.expense_owes(member_id,due_month);
alter table public.expense_owes enable row level security;
drop policy if exists expense_owes_select on public.expense_owes;
drop policy if exists expense_owes_insert on public.expense_owes;
drop policy if exists expense_owes_update on public.expense_owes;
drop policy if exists expense_owes_delete on public.expense_owes;
create policy expense_owes_select on public.expense_owes
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id=expense_id and private.is_family_member(e.family_id)));
create policy expense_owes_insert on public.expense_owes
  for insert to authenticated
  with check (exists (select 1 from public.expenses e where e.id=expense_id and private.is_family_member(e.family_id)));
create policy expense_owes_update on public.expense_owes
  for update to authenticated
  using (exists (select 1 from public.expenses e where e.id=expense_id and private.is_family_member(e.family_id)))
  with check (exists (select 1 from public.expenses e where e.id=expense_id and private.is_family_member(e.family_id)));
create policy expense_owes_delete on public.expense_owes
  for delete to authenticated
  using (exists (select 1 from public.expenses e where e.id=expense_id and private.is_family_member(e.family_id)));

alter table public.transfer_expense_links add column if not exists owe_id uuid references public.expense_owes(id) on delete set null;
create index if not exists transfer_expense_links_owe_idx on public.transfer_expense_links(owe_id);
