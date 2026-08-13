-- ============================================================================
-- 0027_family_goals_display_names.sql
-- get_family_weekly_goals: fetch display_name from auth.users as fallback
-- so that existing members without a public.profiles row still show a name.
-- ============================================================================

create or replace function public.get_family_weekly_goals(
  p_family_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  weekly_goal numeric,
  week_income numeric,
  remaining numeric,
  percent numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date;
  v_end date;
  v_now timestamptz := now() at time zone 'America/Los_Angeles';
  v_weekday int;
  v_today date;
begin
  if not public.is_family_member(p_family_id, auth.uid()) then
    raise exception 'FAMILY_ACCESS_DENIED';
  end if;

  v_today := v_now::date;
  v_weekday := extract(dow from v_now);
  v_start := v_today - (case when v_weekday = 0 then 6 else v_weekday - 1 end);
  v_end := v_start + 6;

  return query
  select
    fm.user_id,
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'display_name',
      split_part(u.email::text, '@', 1)
    )::text as display_name,
    coalesce(g.weekly_goal, 1400) as weekly_goal,
    coalesce(i.week_income, 0) as week_income,
    greatest(coalesce(g.weekly_goal, 1400) - coalesce(i.week_income, 0), 0) as remaining,
    case
      when coalesce(g.weekly_goal, 1400) > 0
      then round((coalesce(i.week_income, 0) / coalesce(g.weekly_goal, 1400)) * 100, 2)
      else 0
    end as percent
  from public.family_members fm
  join auth.users u on u.id = fm.user_id
  left join public.profiles p on p.user_id = fm.user_id
  left join public.family_member_goals g
    on g.family_id = fm.family_id and g.user_id = fm.user_id
  left join lateral (
    select coalesce(sum(amount), 0) as week_income
    from public.income
    where income.family_id = p_family_id
      and income.user_id = fm.user_id
      and income.record_date between v_start and v_end
  ) i on true
  where fm.family_id = p_family_id;
end;
$$;
