-- ============================================================================
-- 0010_financial_integrity.sql
-- FINAL / PRODUCTION
--
-- AİLE FİNANSAL BÜTÜNLÜĞÜ
--
-- Amaç:
--   1. Kredi kartı borçlarının veri tabanı seviyesinde korunması.
--   2. Kredi limiti ile mevcut borç arasında tutarlılık sağlanması.
--   3. Ödeme tarihi bilgilerinin güvenli tutulması.
--   4. Aile finansal özetinin otomatik hesaplanması.
--   5. Gelir / gider / kredi kartı değişikliklerinde özetin anında güncellenmesi.
--   6. Tüm aile cihazlarında Realtime ile aynı finansal durumun gösterilmesi.
--   7. Kredi kartı borcunun net bakiyeden ikinci kez düşülmesini engellemek.
--
-- ÖNEMLİ FİNANS MANTIĞI:
--
--   Net Bakiye = Toplam Gelir - Toplam Gider
--
--   Kredi kartı borcu ayrıca gösterilir:
--
--   Toplam Kart Borcu = SUM(current_balance)
--
-- Kredi kartı borcu NET BAKİYE'den ayrıca düşülmez.
-- Çünkü kredi kartı ile yapılan harcama expenses tablosunda tutuluyorsa
-- aynı harcamayı ikinci kez düşmek finansal bakiyeyi yanlış hesaplar.
--
-- ============================================================================


-- ============================================================================
-- 1. CREDIT CARD INTEGRITY
-- ============================================================================

-- Mevcut constraint varsa güvenli şekilde kaldır.
alter table if exists public.credit_cards
  drop constraint if exists credit_cards_balance_check;


-- Kredi kartı borcu negatif olamaz.
alter table if exists public.credit_cards
  add constraint credit_cards_balance_check
  check (current_balance >= 0);


-- Kredi limiti varsa mevcut borç limiti aşamaz.
alter table if exists public.credit_cards
  drop constraint if exists credit_cards_balance_limit_check;


alter table if exists public.credit_cards
  add constraint credit_cards_balance_limit_check
  check (
    credit_limit is null
    or current_balance <= credit_limit
  );


-- Minimum ödeme negatif olamaz.
alter table if exists public.credit_cards
  drop constraint if exists credit_cards_minimum_payment_check;


alter table if exists public.credit_cards
  add constraint credit_cards_minimum_payment_check
  check (minimum_payment >= 0);


-- Minimum ödeme mevcut borçtan büyük olamaz.
--
-- Not:
-- current_balance = 0 ise minimum_payment de 0 olmalıdır.
alter table if exists public.credit_cards
  drop constraint if exists credit_cards_minimum_payment_balance_check;


alter table if exists public.credit_cards
  add constraint credit_cards_minimum_payment_balance_check
  check (
    minimum_payment <= current_balance
  );


-- ============================================================================
-- 2. PAYMENT DATE CONSISTENCY
-- ============================================================================

alter table if exists public.credit_cards
  drop constraint if exists credit_cards_payment_date_check;


alter table if exists public.credit_cards
  add constraint credit_cards_payment_date_check
  check (
    next_payment_date is null
    or next_payment_date >= '2000-01-01'::date
  );


-- ============================================================================
-- 3. FAMILY FINANCIAL SUMMARY TABLE
-- ============================================================================

create table if not exists public.family_financial_summaries (
  family_id uuid primary key
    references public.families(id)
    on delete cascade,

  total_income numeric(14, 2) not null default 0,

  total_expenses numeric(14, 2) not null default 0,

  total_card_debt numeric(14, 2) not null default 0,

  net_balance numeric(14, 2) not null default 0,

  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 4. SUMMARY INDEX
-- ============================================================================

create index if not exists idx_family_financial_summaries_updated
on public.family_financial_summaries(updated_at);


-- ============================================================================
-- 5. SUMMARY RECALCULATION FUNCTION
-- ============================================================================

create or replace function public.recalculate_family_financial_summary(
  p_family_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_income numeric(14, 2);
  v_total_expenses numeric(14, 2);
  v_total_card_debt numeric(14, 2);
  v_net_balance numeric(14, 2);
begin

  if p_family_id is null then
    return;
  end if;


  -- ========================================================================
  -- AİLE BAZLI TRANSACTION LOCK
  -- ========================================================================
  --
  -- Aynı ailede aynı anda birden fazla cihaz işlem yaptığında
  -- özet tablosunun tutarsız hale gelmesini önler.
  --

  perform pg_advisory_xact_lock(
    hashtextextended(p_family_id::text, 0)
  );


  -- ========================================================================
  -- TOTAL INCOME
  -- ========================================================================

  select coalesce(sum(amount), 0)
  into v_total_income
  from public.income
  where family_id = p_family_id;


  -- ========================================================================
  -- TOTAL EXPENSES
  -- ========================================================================

  select coalesce(sum(amount), 0)
  into v_total_expenses
  from public.expenses
  where family_id = p_family_id;


  -- ========================================================================
  -- TOTAL CREDIT CARD DEBT
  -- ========================================================================
  --
  -- Kart borcu net bakiyeden ayrıca düşülmez.
  -- Ayrı bir finansal yükümlülük olarak gösterilir.
  --

  select coalesce(sum(current_balance), 0)
  into v_total_card_debt
  from public.credit_cards
  where family_id = p_family_id;


  -- ========================================================================
  -- NET BALANCE
  -- ========================================================================
  --
  -- ÖNEMLİ:
  --
  -- Kart borcu burada tekrar düşülmez.
  --
  -- Gelir - Gider = Net Bakiye
  --

  v_net_balance :=
    v_total_income
    - v_total_expenses;


  -- ========================================================================
  -- UPSERT SUMMARY
  -- ========================================================================

  insert into public.family_financial_summaries (
    family_id,
    total_income,
    total_expenses,
    total_card_debt,
    net_balance,
    updated_at
  )
  values (
    p_family_id,
    v_total_income,
    v_total_expenses,
    v_total_card_debt,
    v_net_balance,
    now()
  )
  on conflict (family_id)
  do update
  set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    total_card_debt = excluded.total_card_debt,
    net_balance = excluded.net_balance,
    updated_at = now();

end;
$$;


-- ============================================================================
-- 6. GENERIC FAMILY SUMMARY TRIGGER FUNCTION
-- ============================================================================
--
-- INSERT / UPDATE / DELETE işlemlerinden sonra ilgili aile özetini
-- otomatik olarak yeniden hesaplar.
--
-- DELETE işleminde OLD.family_id,
-- INSERT işleminde NEW.family_id kullanılır.
--
-- UPDATE durumunda aile değişmişse hem eski hem yeni aile hesaplanır.
--
-- ============================================================================

create or replace function public.trigger_recalculate_family_financial_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  -- ========================================================================
  -- DELETE
  -- ========================================================================

  if tg_op = 'DELETE' then

    perform public.recalculate_family_financial_summary(
      old.family_id
    );

    return old;

  end if;


  -- ========================================================================
  -- UPDATE
  -- ========================================================================

  if tg_op = 'UPDATE' then

    -- Aile değişmişse eski aileyi de yeniden hesapla.
    if old.family_id is distinct from new.family_id then

      perform public.recalculate_family_financial_summary(
        old.family_id
      );

    end if;


    perform public.recalculate_family_financial_summary(
      new.family_id
    );

    return new;

  end if;


  -- ========================================================================
  -- INSERT
  -- ========================================================================

  perform public.recalculate_family_financial_summary(
    new.family_id
  );

  return new;

end;
$$;


-- ============================================================================
-- 7. REMOVE OLD TRIGGERS
-- ============================================================================

drop trigger if exists
trigger_recalculate_family_summary_income
on public.income;


drop trigger if exists
trigger_recalculate_family_summary_expenses
on public.expenses;


drop trigger if exists
trigger_recalculate_family_summary_credit_cards
on public.credit_cards;


-- ============================================================================
-- 8. INCOME REALTIME FINANCIAL TRIGGER
-- ============================================================================

create trigger
trigger_recalculate_family_summary_income
after insert or update or delete
on public.income
for each row
execute function public.trigger_recalculate_family_financial_summary();


-- ============================================================================
-- 9. EXPENSE REALTIME FINANCIAL TRIGGER
-- ============================================================================

create trigger
trigger_recalculate_family_summary_expenses
after insert or update or delete
on public.expenses
for each row
execute function public.trigger_recalculate_family_financial_summary();


-- ============================================================================
-- 10. CREDIT CARD REALTIME FINANCIAL TRIGGER
-- ============================================================================

create trigger
trigger_recalculate_family_summary_credit_cards
after insert or update or delete
on public.credit_cards
for each row
execute function public.trigger_recalculate_family_financial_summary();


-- ============================================================================
-- 11. PAYMENT REMINDER INDEX
-- ============================================================================
--
-- Ödeme tarihi yaklaşan ve henüz ödenmemiş kartları hızlı bulmak için.
--
-- Uygulama tarafında:
--
--   next_payment_date <= CURRENT_DATE + 7
--   payment_completed = false
--
-- şeklinde sorgulanabilir.
--
-- ============================================================================

create index if not exists idx_credit_cards_upcoming_payments
on public.credit_cards (
  family_id,
  next_payment_date
)
where payment_completed = false
  and next_payment_date is not null;


-- ============================================================================
-- 12. UPCOMING PAYMENT VIEW
-- ============================================================================
--
-- Ana ekran için kullanılabilecek güvenli görünüm.
--
-- Sadece ödeme yaklaşan kartları döndürür.
--
-- 7 günlük pencere kullanılır.
--
-- ============================================================================

create or replace view public.family_upcoming_card_payments
as
select
  id,
  family_id,
  name,
  current_balance,
  minimum_payment,
  next_payment_date,
  payment_completed,
  credit_limit,
  autopay_enabled,
  case
    when next_payment_date < current_date
      then 'overdue'

    when next_payment_date = current_date
      then 'today'

    when next_payment_date <= current_date + 3
      then 'urgent'

    when next_payment_date <= current_date + 7
      then 'upcoming'

    else 'later'
  end as payment_status,

  case
    when next_payment_date < current_date
      then current_date - next_payment_date

    else next_payment_date - current_date
  end as days_from_payment

from public.credit_cards
where payment_completed = false
  and next_payment_date is not null
  and next_payment_date <= current_date + 7;


-- ============================================================================
-- 13. REALTIME FOR FINANCIAL SUMMARY
-- ============================================================================
--
-- 0008 içerisinde family_financial_summaries bulunmuyorsa güvenli şekilde
-- supabase_realtime publication'a eklenir.
--
-- ============================================================================

do $$
begin

  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    create publication supabase_realtime;

  end if;


  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c
      on c.oid = pr.prrelid
    join pg_namespace n
      on n.oid = c.relnamespace
    where pr.prpubid = (
      select oid
      from pg_publication
      where pubname = 'supabase_realtime'
    )
    and n.nspname = 'public'
    and c.relname = 'family_financial_summaries'
  ) then

    alter publication supabase_realtime
      add table public.family_financial_summaries;

  end if;

end
$$;


-- ============================================================================
-- 14. REPLICA IDENTITY
-- ============================================================================
--
-- Summary UPDATE olaylarında eski/yeni kayıtların güvenilir şekilde
-- taşınmasını sağlar.
--
-- ============================================================================

alter table public.family_financial_summaries
  replica identity full;


-- ============================================================================
-- 15. SECURITY
-- ============================================================================

revoke all
on public.family_financial_summaries
from anon;


-- Authenticated kullanıcıların tabloyu doğrudan değiştirmesine izin verilmez.
-- Özet trigger tarafından yönetilir.

revoke insert, update, delete
on public.family_financial_summaries
from authenticated;


-- Okuma RLS üzerinden yapılacaktır.
grant select
on public.family_financial_summaries
to authenticated;


-- Recalculation function yalnızca trigger/RPC mantığı tarafından kullanılabilir.
revoke execute
on function public.recalculate_family_financial_summary(uuid)
from public;


revoke execute
on function public.trigger_recalculate_family_financial_summary()
from public;


-- ============================================================================
-- 16. RLS
-- ============================================================================

alter table public.family_financial_summaries
enable row level security;


-- ========================================================================
-- FAMILY MEMBER READ POLICY
-- ========================================================================
--
-- Bir aile üyesi yalnızca kendi family_id özetini görebilir.
--
-- ========================================================================

drop policy if exists
"family_members_can_view_financial_summary"
on public.family_financial_summaries;


create policy
"family_members_can_view_financial_summary"
on public.family_financial_summaries
for select
to authenticated
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_financial_summaries.family_id
      and fm.user_id = auth.uid()
  )
);


-- ============================================================================
-- 17. DOCUMENTATION
-- ============================================================================

comment on table public.family_financial_summaries is
'Aile seviyesinde otomatik hesaplanan finansal özet. Gelir, gider, kredi kartı borcu ve net bakiyeyi içerir.';


comment on column public.family_financial_summaries.total_income is
'Ailenin toplam gelirleri.';


comment on column public.family_financial_summaries.total_expenses is
'Ailenin toplam giderleri.';


comment on column public.family_financial_summaries.total_card_debt is
'Ailenin tüm aktif kredi kartlarının güncel toplam borcu.';


comment on column public.family_financial_summaries.net_balance is
'Toplam gelir eksi toplam gider. Kredi kartı borcu ayrıca düşülmez; çift sayımı önlemek için ayrı gösterilir.';


comment on view public.family_upcoming_card_payments is
'Önümüzdeki 7 gün içinde ödenmesi gereken veya gecikmiş aile kredi kartı ödemeleri.';


comment on function public.recalculate_family_financial_summary(uuid) is
'Aile finansal özetini gelir, gider ve kredi kartı borçlarından atomik transaction kilidi altında yeniden hesaplar.';


-- ============================================================================
-- END OF 0010
-- ===========================================================================================================================
