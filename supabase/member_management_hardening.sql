-- Ledgerly member management hardening
-- Applied to production on 2026-09-24.
-- Adds invitation timestamp tracking and makes permanent member deletion owner-only.

alter table public.family_members
  add column if not exists invited_at timestamptz;

drop policy if exists family_members_all on public.family_members;

create policy family_members_select
  on public.family_members
  for select to authenticated
  using ((select private.is_family_member(family_members.family_id)));

create policy family_members_insert
  on public.family_members
  for insert to authenticated
  with check ((select private.is_family_member(family_members.family_id)));

create policy family_members_update
  on public.family_members
  for update to authenticated
  using ((select private.is_family_member(family_members.family_id)))
  with check ((select private.is_family_member(family_members.family_id)));

create policy family_members_delete_owner
  on public.family_members
  for delete to authenticated
  using (
    user_id is distinct from (
      select f.created_by from public.families f where f.id = family_members.family_id
    )
    and exists (
      select 1
      from public.families f
      where f.id = family_members.family_id
        and f.created_by = (select auth.uid())
    )
  );
