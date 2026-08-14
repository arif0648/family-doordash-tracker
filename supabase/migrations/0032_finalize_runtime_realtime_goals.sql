-- Phase 3.2 runtime fixes: atomic income+mileage, per-vehicle goals, realtime.

create or replace function public.create_income_with_mileage(
  p_family_id uuid, p_vehicle_id uuid, p_amount numeric, p_record_date date,
  p_closing_mileage numeric, p_note text default null
)
returns table (income_id uuid, mileage_log_id uuid, miles_driven numeric)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_prev_mileage numeric;
  v_miles_driven numeric;
  v_mileage_id uuid;
  v_income_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_family_member(p_family_id, v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_record_date is null then raise exception 'INVALID_RECORD_DATE'; end if;
  if p_closing_mileage is null or p_closing_mileage < 0 then raise exception 'INVALID_MILEAGE'; end if;
  if not exists (select 1 from public.vehicles where id=p_vehicle_id and family_id=p_family_id and is_active) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_vehicle_id::text));
  select ml.closing_mileage into v_prev_mileage
  from public.mileage_log ml where ml.vehicle_id=p_vehicle_id
  order by ml.record_date desc, ml.created_at desc limit 1;
  if v_prev_mileage is not null and p_closing_mileage < v_prev_mileage then
    raise exception 'MILEAGE_LOWER_THAN_PREVIOUS';
  end if;
  v_miles_driven := round((p_closing_mileage-coalesce(v_prev_mileage,0))::numeric,1);

  insert into public.mileage_log(family_id,vehicle_id,user_id,record_date,closing_mileage,miles_driven)
  values(p_family_id,p_vehicle_id,v_user_id,p_record_date,p_closing_mileage,v_miles_driven)
  returning id into v_mileage_id;
  insert into public.income(family_id,vehicle_id,user_id,amount,record_date,note,mileage_log_id)
  values(p_family_id,p_vehicle_id,v_user_id,p_amount,p_record_date,p_note,v_mileage_id)
  returning id into v_income_id;
  update public.mileage_log set income_id=v_income_id where id=v_mileage_id;
  return query select v_income_id,v_mileage_id,v_miles_driven;
end;
$$;
grant execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text) to authenticated;
revoke execute on function public.create_income_with_mileage(uuid,uuid,numeric,date,numeric,text) from public;

alter table public.family_member_goals add column if not exists vehicle_id uuid references public.vehicles(id) on delete cascade;
alter table public.family_member_goals add column if not exists id uuid default gen_random_uuid();
update public.family_member_goals set id=gen_random_uuid() where id is null;
alter table public.family_member_goals alter column id set not null;
alter table public.family_member_goals drop constraint if exists family_member_goals_pkey;
alter table public.family_member_goals add constraint family_member_goals_pkey primary key(id);
create unique index if not exists family_member_goals_family_member_legacy_unique
  on public.family_member_goals(family_id,user_id) where vehicle_id is null;
create unique index if not exists family_member_goals_family_vehicle_unique
  on public.family_member_goals(family_id,vehicle_id) where vehicle_id is not null;

create or replace function public.ensure_member_goal()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.family_member_goals(family_id,user_id,weekly_goal)
  values(new.family_id,new.user_id,1400)
  on conflict(family_id,user_id) where vehicle_id is null do nothing;
  return new;
end;
$$;

-- Keep the legacy per-member RPC valid after introducing vehicle-scoped goals.
create or replace function public.set_weekly_goal(p_family_id uuid,p_weekly_goal numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_family_member(p_family_id,v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_weekly_goal is null or p_weekly_goal<=0 then raise exception 'INVALID_GOAL'; end if;
  insert into public.family_member_goals(family_id,user_id,weekly_goal,updated_at)
  values(p_family_id,v_user_id,p_weekly_goal,now())
  on conflict(family_id,user_id) where vehicle_id is null
  do update set weekly_goal=excluded.weekly_goal,updated_at=now();
end;
$$;
grant execute on function public.set_weekly_goal(uuid,numeric) to authenticated;
revoke execute on function public.set_weekly_goal(uuid,numeric) from public;

create or replace function public.set_vehicle_weekly_goal(p_family_id uuid,p_vehicle_id uuid,p_weekly_goal numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_family_member(p_family_id,v_user_id) then raise exception 'FAMILY_ACCESS_DENIED'; end if;
  if p_weekly_goal is null or p_weekly_goal<=0 then raise exception 'INVALID_WEEKLY_GOAL'; end if;
  if not exists(select 1 from public.vehicles where id=p_vehicle_id and family_id=p_family_id and is_active) then raise exception 'VEHICLE_NOT_FOUND'; end if;
  insert into public.family_member_goals(family_id,user_id,vehicle_id,weekly_goal,updated_at)
  values(p_family_id,v_user_id,p_vehicle_id,p_weekly_goal,now())
  on conflict(family_id,vehicle_id) where vehicle_id is not null
  do update set weekly_goal=excluded.weekly_goal,updated_at=now();
end;
$$;
grant execute on function public.set_vehicle_weekly_goal(uuid,uuid,numeric) to authenticated;
revoke execute on function public.set_vehicle_weekly_goal(uuid,uuid,numeric) from public;

do $$
declare t text;
begin
  foreach t in array array['income','expenses','mileage_log','fixed_expenses','vehicles','credit_cards','credit_card_payments','appointments','notifications','work_sessions','family_member_goals'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
