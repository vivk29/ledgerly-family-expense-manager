-- Ledgerly security hardening for an existing environment.
-- This is intentionally NOT a numbered migration because the live project has
-- migration history that is newer/different from the repository's four public
-- migration files. Apply deliberately to the target environment, then verify
-- with Supabase Security Advisors.
--
-- Changes:
-- 1. Move the RLS helper is_family_member() out of exposed public schema.
-- 2. Keep the helper callable by authenticated RLS evaluation only.
-- 3. Restrict create_family()/join_family() RPC execution to authenticated users.
-- 4. Preserve SECURITY DEFINER only where it is required for the current RLS/RPC design.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_family_member(target_family uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family
      and fm.user_id = (select auth.uid())
      and fm.is_active
  )
  or exists (
    select 1
    from public.families f
    where f.id = target_family
      and f.created_by = (select auth.uid())
  );
$function$;

revoke execute on function private.is_family_member(uuid) from public, anon;
grant execute on function private.is_family_member(uuid) to authenticated;

alter policy budgets_all on public.budgets
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy categories_all on public.categories
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy emis_all on public.emis
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy allocations_all on public.expense_allocations
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_allocations.expense_id
      and (select private.is_family_member(e.family_id))
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_allocations.expense_id
      and (select private.is_family_member(e.family_id))
  ));

alter policy payers_all on public.expense_payers
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_payers.expense_id
      and (select private.is_family_member(e.family_id))
  ))
  with check (exists (
    select 1 from public.expenses e
    where e.id = expense_payers.expense_id
      and (select private.is_family_member(e.family_id))
  ));

alter policy expenses_all on public.expenses
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy families_select on public.families
  using ((select private.is_family_member(id)));

alter policy family_members_all on public.family_members
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy incomes_all on public.incomes
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy recurring_all on public.recurring_expenses
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy settlements_all on public.settlements
  using ((select private.is_family_member(family_id)))
  with check ((select private.is_family_member(family_id)));

alter policy family_transfers_select on public.family_transfers
  using ((select private.is_family_member(family_id)));

alter policy family_transfers_insert on public.family_transfers
  with check ((select private.is_family_member(family_id)));

alter policy family_loans_select on public.family_loans
  using ((select private.is_family_member(family_id)));

alter policy family_loans_insert on public.family_loans
  with check ((select private.is_family_member(family_id)));

alter policy ledgerly_receipts_insert on storage.objects
  with check (
    bucket_id = 'ledgerly-receipts'
    and (select private.is_family_member(((storage.foldername(name))[1])::uuid))
  );

alter policy ledgerly_receipts_select on storage.objects
  using (
    bucket_id = 'ledgerly-receipts'
    and (select private.is_family_member(((storage.foldername(name))[1])::uuid))
  );

drop function public.is_family_member(uuid);

revoke execute on function public.create_family(text,text) from public, anon;
grant execute on function public.create_family(text,text) to authenticated;

revoke execute on function public.join_family(text,text,text) from public, anon;
grant execute on function public.join_family(text,text,text) to authenticated;
