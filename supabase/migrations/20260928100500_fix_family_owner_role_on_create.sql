-- Ensure newly created families mark their creator as the owner member.
create or replace function public.create_family(p_name text,p_pin text)
returns table(family_id uuid,family_name text,family_code text)
language plpgsql security definer set search_path to ''
as $function$
declare v_family uuid; v_code text; v_name text;
begin
 if (select auth.uid()) is null then raise exception 'You must be signed in'; end if;
 if coalesce(length(trim(p_name)),0)<2 then raise exception 'Family name is required'; end if;
 if p_pin !~ '^[0-9]{4,6}$' then raise exception 'Family PIN must be 4 to 6 digits'; end if;
 loop
  v_code:=upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8));
  exit when not exists(select 1 from public.families f where f.family_code=v_code);
 end loop;
 v_name:=trim(p_name);
 insert into public.families(name,created_by,family_code,join_pin_hash)
 values(v_name,(select auth.uid()),v_code,extensions.crypt(p_pin,extensions.gen_salt('bf')))
 returning id into v_family;
 insert into public.family_members(family_id,user_id,name,email,role,is_active)
 values(v_family,(select auth.uid()),coalesce(split_part((select email from auth.users where id=(select auth.uid())),'@',1),'Owner'),(select email from auth.users where id=(select auth.uid())),'owner',true);
 insert into public.categories(family_id,name,kind) values
 (v_family,'Food & Groceries','expense'),(v_family,'Housing & Rent','expense'),(v_family,'Utilities','expense'),(v_family,'Transport','expense'),(v_family,'Education','expense'),(v_family,'Medical & Health','expense'),(v_family,'Shopping','expense'),(v_family,'Entertainment','expense'),(v_family,'Insurance','expense'),(v_family,'Personal Care','expense'),(v_family,'Family & Kids','expense'),(v_family,'Subscriptions','expense'),(v_family,'Other','expense'),(v_family,'Salary','income'),(v_family,'Business','income'),(v_family,'Interest','income'),(v_family,'Other Income','income');
 return query select v_family,v_name,v_code;
end;$function$;