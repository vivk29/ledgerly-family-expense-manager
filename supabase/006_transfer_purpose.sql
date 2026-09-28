-- Transfer purpose: distinguish household funding from personal obligations.
alter table public.family_transfers
  add column if not exists purpose text not null default 'personal'
  check (purpose in ('personal','loan','home_expense'));

create index if not exists family_transfers_purpose_idx
  on public.family_transfers(family_id,purpose);
