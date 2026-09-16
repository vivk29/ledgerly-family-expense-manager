-- Preserve the user's chosen split mode so editing an expense cannot silently
-- convert custom or percentage allocations into an equal split.
alter table public.expenses
  add column if not exists split_mode text not null default 'equal';

-- Historical rows did not store the original mode. Use a conservative backfill:
-- one allocation => single; multiple allocations => equal.
update public.expenses e
set split_mode = case
  when (select count(*) from public.expense_allocations a where a.expense_id = e.id) <= 1
    then 'single'
  else 'equal'
end
where e.split_mode is null or e.split_mode = 'equal';

alter table public.expenses
  drop constraint if exists expenses_split_mode_check;

alter table public.expenses
  add constraint expenses_split_mode_check
  check (split_mode in ('single','equal','custom','percentage'));

create index if not exists expenses_split_mode_idx on public.expenses(split_mode);
