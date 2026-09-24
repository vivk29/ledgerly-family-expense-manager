-- Invitation hardening: persist invitation attempts and enforce one email per family.

alter table public.family_members
  add column if not exists invited_at timestamptz;

create unique index if not exists family_members_family_email_lower_uidx
  on public.family_members (family_id, lower(trim(email)))
  where email is not null and trim(email) <> '';
