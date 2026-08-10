-- ============================================================================
-- 0009_auto_family_provisioning.sql
-- FINAL / PRODUCTION / STRICT ATOMIC
--
-- Amaç:
--   1. Income -> Mileage dairesel FK yapısını tamamen kaldırmak.
--   2. Mileage -> Income tek yönlü ilişkiyi garanti etmek.
--   3. Bir income kaydına en fazla bir mileage_log bağlanmasını sağlamak.
--   4. Vehicle + Family çapraz izolasyonunu composite FK ile zorunlu kılmak.
--   5. Gelir silme işlemini güvenli hale getirmek.
--   6. Yeni kullanıcı için otomatik Family + Owner + 3 Vehicle oluşturmak.
--
-- Kritik davranış:
--   Yeni kullanıcı provisioning işlemi auth.users INSERT transaction'ı
--   içerisinde atomik olarak çalışır.
--
--   Family + Owner + 3 Vehicle adımlarından herhangi biri başarısız olursa
--   trigger exception üretir ve transaction ROLLBACK edilir.
--
--   Böylece yarım provisioning oluşması engellenir.
--
-- Gerçek tablo isimleri:
--   public.income
--   public.mileage_log
--   public.expenses
--   public.credit_cards
--   public.vehicles
--
-- ============================================================================


-- ============================================================================
-- 1. INCOME -> MILEAGE DAİRESEL FK TEMİZLİĞİ
-- ============================================================================

alter table if exists public.income
  drop constraint if exists income_mileage_log_id_fkey;

alter table if exists public.income
  drop column if exists mileage_log_id;


-- ============================================================================
-- 2. MILEAGE -> INCOME TEK YÖNLÜ FOREIGN KEY
-- ============================================================================

alter table if exists public.mileage_log
  drop constraint if exists mileage_log_income_id_fkey;

alter table if exists public.mileage_log
  add constraint mileage_log_income_id_fkey
  foreign key (income_id)
  references public.income(id)
  on delete cascade;


-- ============================================================================
-- 3. INCOME <-> MILEAGE 1:1 KISITLAMASI
--
-- Bir income kaydına en fazla bir mileage_log bağlanabilir.
--
-- income_id NULL olabilir.
-- NULL olan mileage kayıtları birbirleriyle çakışmaz.
-- ============================================================================

create unique index if not exists uq_mileage_log_income
  on public.mileage_log(income_id)
  where income_id is not null;


-- ============================================================================
-- 4. VEHICLE + FAMILY COMPOSITE UNIQUE KEY
--
-- Composite FK'lerin referans verebilmesi için gereklidir.
-- ============================================================================

alter table if exists public.vehicles
  drop constraint if exists vehicles_id_family_id_key;

alter table if exists public.vehicles
  add constraint vehicles_id_family_id_key
  unique (id, family_id);


-- ============================================================================
-- 5. INCOME VEHICLE/FAMILY ISOLATION
--
-- Bir income kaydı başka bir aileye ait vehicle ile eşleşemez.
-- ============================================================================

alter table if exists public.income
  drop constraint if exists income_vehicle_family_fkey;

alter table if exists public.income
  add constraint income_vehicle_family_fkey
  foreign key (vehicle_id, family_id)
  references public.vehicles(id, family_id)
  on delete restrict;


-- ============================================================================
-- 6. MILEAGE_LOG VEHICLE/FAMILY ISOLATION
--
-- Bir mileage kaydı başka bir aileye ait vehicle ile eşleşemez.
-- ============================================================================

alter table if exists public.mileage_log
  drop constraint if exists mileage_log_vehicle_family_fkey;

alter table if exists public.mileage_log
  add constraint mileage_log_vehicle_family_fkey
  foreign key (vehicle_id, family_id)
  references public.vehicles(id, family_id)
  on delete restrict;


-- ============================================================================
-- 7. EXPENSE VEHICLE/FAMILY ISOLATION
--
-- vehicle_id nullable olduğu için araç silindiğinde:
--
--   vehicle_id -> NULL
--   family_id  -> korunur
--
-- Böylece finansal geçmiş kaybolmaz.
-- ============================================================================

alter table if exists public.expenses
  drop constraint if exists expenses_vehicle_family_fkey;

alter table if exists public.expenses
  add constraint expenses_vehicle_family_fkey
  foreign key (vehicle_id, family_id)
  references public.vehicles(id, family_id)
  on delete set null (vehicle_id);


-- ============================================================================
-- 8. GÜVENLİ INCOME + MILEAGE SİLME RPC
-- ============================================================================

create or replace function public.delete_income_with_mileage(
  p_income_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle_id uuid;
  v_family_id uuid;
  v_owner_id uuid;
begin

  -- --------------------------------------------------------------------------
  -- Authentication
  -- --------------------------------------------------------------------------

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;


  -- --------------------------------------------------------------------------
  -- Income kaydını kilitleyerek oku
  -- --------------------------------------------------------------------------

  select
    vehicle_id,
    family_id,
    user_id
  into
    v_vehicle_id,
    v_family_id,
    v_owner_id
  from public.income
  where id = p_income_id
  for update;


  if not found then
    raise exception 'INCOME_NOT_FOUND';
  end if;


  -- --------------------------------------------------------------------------
  -- Kayıt sahibi kontrolü
  -- --------------------------------------------------------------------------

  if v_owner_id <> v_user_id then
    raise exception
      'NOT_OWNER: Yalnızca kaydı oluşturan kullanıcı silebilir.';
  end if;


  -- --------------------------------------------------------------------------
  -- Aktif aile üyeliği kontrolü
  -- --------------------------------------------------------------------------

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = v_family_id
      and fm.user_id = v_user_id
  ) then

    raise exception
      'NOT_AUTHORIZED: Bu aileye ait kayıtları silme yetkiniz yok.';

  end if;


  -- --------------------------------------------------------------------------
  -- Vehicle + Family bütünlük kontrolü
  -- --------------------------------------------------------------------------

  if not exists (
    select 1
    from public.vehicles v
    where v.id = v_vehicle_id
      and v.family_id = v_family_id
  ) then

    raise exception 'VEHICLE_FAMILY_MISMATCH';

  end if;


  -- --------------------------------------------------------------------------
  -- Araç bazlı transaction advisory lock
  --
  -- Aynı araç üzerinde eşzamanlı mileage/income işlemlerinin
  -- zinciri bozmasını önlemek için kullanılır.
  -- --------------------------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(v_vehicle_id::text, 0)
  );


  -- --------------------------------------------------------------------------
  -- Income silinir.
  --
  -- mileage_log.income_id -> income.id
  -- ON DELETE CASCADE sayesinde bağlı mileage_log otomatik silinir.
  -- --------------------------------------------------------------------------

  delete from public.income
  where id = p_income_id;


  -- --------------------------------------------------------------------------
  -- Kalan mileage zincirini doğrula
  -- --------------------------------------------------------------------------

  perform public.validate_mileage_chain(v_vehicle_id);

end;
$$;


-- ============================================================================
-- 9. YENİ KULLANICI AİLE PROVISIONING
--
-- Yeni kullanıcı:
--
--   auth.users
--        ↓
--   families
--        ↓
--   family_members / owner
--        ↓
--   3 vehicles
--
-- Herhangi bir INSERT başarısız olursa exception fırlatılır.
-- Trigger auth.users transaction'ının parçası olduğu için işlem ROLLBACK olur.
-- ============================================================================

create or replace function public.handle_new_user_family_provisioning()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_display_name text;
  v_family_name text;
begin

  -- --------------------------------------------------------------------------
  -- Kullanıcı görünen adını metadata'dan al
  -- --------------------------------------------------------------------------

  v_display_name :=
    nullif(
      trim(new.raw_user_meta_data ->> 'display_name'),
      ''
    );


  -- --------------------------------------------------------------------------
  -- Metadata'da isim yoksa email'in @ öncesindeki bölümünü kullan
  -- --------------------------------------------------------------------------

  if v_display_name is null then

    v_display_name :=
      nullif(
        trim(
          split_part(
            coalesce(new.email, ''),
            '@',
            1
          )
        ),
        ''
      );

  end if;


  -- --------------------------------------------------------------------------
  -- Son güvenli varsayılan
  -- --------------------------------------------------------------------------

  if v_display_name is null then
    v_display_name := 'Sürücü';
  end if;


  v_family_name := v_display_name || ' Ailesi';


  -- --------------------------------------------------------------------------
  -- IDEMPOTENCY
  --
  -- Kullanıcı zaten bir aileye bağlıysa tekrar family oluşturma.
  -- --------------------------------------------------------------------------

  if exists (
    select 1
    from public.family_members
    where user_id = new.id
  ) then

    return new;

  end if;


  -- --------------------------------------------------------------------------
  -- 1. FAMILY
  -- --------------------------------------------------------------------------

  insert into public.families (
    name
  )
  values (
    v_family_name
  )
  returning id into v_family_id;


  -- --------------------------------------------------------------------------
  -- 2. OWNER
  -- --------------------------------------------------------------------------

  insert into public.family_members (
    family_id,
    user_id,
    role
  )
  values (
    v_family_id,
    new.id,
    'owner'
  );


  -- --------------------------------------------------------------------------
  -- 3. DEFAULT VEHICLES
  --
  -- Aile oluşturulduğunda tam olarak 3 temel araç tahsis edilir.
  -- --------------------------------------------------------------------------

  insert into public.vehicles (
    family_id,
    full_name,
    short_name
  )
  values
    (
      v_family_id,
      '2026 Kia Sportage Hybrid',
      'Kia Sportage'
    ),
    (
      v_family_id,
      '2026 Toyota Corolla XLE Hybrid',
      'Toyota Corolla'
    ),
    (
      v_family_id,
      '2024 Honda Accord Sport Hybrid',
      'Honda Accord'
    );


  -- --------------------------------------------------------------------------
  -- Her şey başarılı
  -- --------------------------------------------------------------------------

  return new;


exception
  when others then

    -- ------------------------------------------------------------------------
    -- STRICT ATOMIC BEHAVIOR
    --
    -- Hata sessizce yutulmaz.
    -- Exception auth.users INSERT transaction'ına geri gönderilir.
    -- Böylece Family / Owner / Vehicle provisioning yarım kalmaz.
    -- ------------------------------------------------------------------------

    raise exception
      'AUTO_FAMILY_PROVISIONING_FAILED: Kayıt geri alındı. Hata: %',
      sqlerrm;

end;
$$;


-- ============================================================================
-- 10. AUTH.USERS TRIGGER
-- ============================================================================

drop trigger if exists on_auth_user_family_provisioning
on auth.users;

create trigger on_auth_user_family_provisioning
after insert
on auth.users
for each row
execute function public.handle_new_user_family_provisioning();


-- ============================================================================
-- 11. FUNCTION PERMISSIONS
-- ============================================================================

-- Provisioning fonksiyonu kullanıcı tarafından doğrudan çağrılamaz.
revoke execute
on function public.handle_new_user_family_provisioning()
from public;

revoke execute
on function public.handle_new_user_family_provisioning()
from authenticated;


-- Income silme RPC'si yalnızca giriş yapmış kullanıcılar tarafından çağrılabilir.
grant execute
on function public.delete_income_with_mileage(uuid)
to authenticated;


-- ============================================================================
-- 12. DOCUMENTATION
-- ============================================================================

comment on function public.delete_income_with_mileage(uuid) is
'Gelir kaydını güvenli şekilde siler. Bağlı mileage_log ON DELETE CASCADE ile otomatik temizlenir ve kalan kilometre zinciri doğrulanır.';

comment on function public.handle_new_user_family_provisioning() is
'Yeni kullanıcı için atomik olarak Family, Owner ve ön tanımlı 3 hibrit araç oluşturur. Herhangi bir provisioning adımı başarısız olursa transaction rollback edilir.';


-- ============================================================================
-- END OF 0009
-- ============================================================================