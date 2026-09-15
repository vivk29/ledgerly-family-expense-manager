-- Fix family-code crypto functions for SECURITY DEFINER search_path isolation.
-- Supabase stores pgcrypto functions in the extensions schema; unqualified
-- gen_random_bytes() fails when the function search_path is intentionally empty.
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
  if (select auth.uid()) is null then raise exception 'You must be signed in'; end if;
  if coalesce(length(trim(p_name)),0) < 2 then raise exception 'Family name is required'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'Family PIN must be 4 to 6 digits'; end if;
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8));
    exit when not exists (select 1 from public.families f where f.family_code=v_code);
  end loop;
  v_name := trim(p_name);
  insert into public.families(name,created_by,family_code,join_pin_hash)
  values(v_name,(select auth.uid()),v_code,extensions.crypt(p_pin,extensions.gen_salt('bf')))
  returning id into v_family;
  insert into public.family_members(family_id,user_id,name,email,is_active)
  values(v_family,(select auth.uid()),coalesce(split_part((select email from auth.users where id=(select auth.uid())),'@',1),'Owner'),(select email from auth.users where id=(select auth.uid())),true);
  insert into public.categories(family_id,name,kind) values
   (v_family,'Food & Groceries','expense'),(v_family,'Housing & Rent','expense'),(v_family,'Utilities','expense'),(v_family,'Transport','expense'),(v_family,'Education','expense'),(v_family,'Medical & Health','expense'),(v_family,'Shopping','expense'),(v_family,'Entertainment','expense'),(v_family,'Insurance','expense'),(v_family,'Personal Care','expense'),(v_family,'Family & Kids','expense'),(v_family,'Subscriptions','expense'),(v_family,'Other','expense'),
   (v_family,'Salary','income'),(v_family,'Business','income'),(v_family,'Interest','income'),(v_family,'Other Income','income');
  return query select v_family,v_name,v_code;
end; $function$;

create or replace function public.join_family(p_code text, p_pin text, p_name text)
returns table(family_id uuid, family_name text, family_code text, member_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_family public.families%rowtype; v_member uuid; v_email text;
begin
 if (select auth.uid()) is null then raise exception 'You must be signed in'; end if;
 select * into v_family from public.families f where upper(f.family_code)=upper(trim(p_code)) limit 1;
 if v_family.id is null then raise exception 'Family code not found'; end if;
 if extensions.crypt(p_pin,v_family.join_pin_hash) <> v_family.join_pin_hash then raise exception 'Verification PIN is incorrect'; end if;
 select email into v_email from auth.users where id=(select auth.uid());
 select id into v_member from public.family_members where family_id=v_family.id and user_id=(select auth.uid()) limit 1;
 if v_member is null then
   insert into public.family_members(family_id,user_id,name,email,is_active) values(v_family.id,(select auth.uid()),coalesce(nullif(trim(p_name),''),split_part(coalesce(v_email,'Member'),'@',1)),v_email,true) returning id into v_member;
 else
   update public.family_members set name=coalesce(nullif(trim(p_name),''),name),email=v_email,is_active=true where id=v_member;
 end if;
 return query select v_family.id,v_family.name,v_family.family_code,v_member;
end; $function$;
