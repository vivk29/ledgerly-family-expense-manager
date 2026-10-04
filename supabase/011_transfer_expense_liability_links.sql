-- Link family reimbursements to the expenses they settle and record mutual-liability offsets.
create table if not exists public.transfer_expense_links (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.family_transfers(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  applied_amount numeric(14,2) not null check(applied_amount > 0),
  liability_offset_amount numeric(14,2) not null default 0 check(liability_offset_amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists transfer_expense_links_transfer_idx on public.transfer_expense_links(transfer_id);
create index if not exists transfer_expense_links_expense_idx on public.transfer_expense_links(expense_id);
alter table public.transfer_expense_links enable row level security;
drop policy if exists transfer_expense_links_select on public.transfer_expense_links;
drop policy if exists transfer_expense_links_insert on public.transfer_expense_links;
create policy transfer_expense_links_select on public.transfer_expense_links
  for select to authenticated
  using (exists (select 1 from public.family_transfers t where t.id=transfer_id and private.is_family_member(t.family_id)));
create policy transfer_expense_links_insert on public.transfer_expense_links
  for insert to authenticated
  with check (exists (select 1 from public.family_transfers t where t.id=transfer_id and private.is_family_member(t.family_id)));
