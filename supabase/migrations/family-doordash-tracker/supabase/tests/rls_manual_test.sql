-- ============================================================================
-- rls_manual_test.sql
--
-- DÜRÜSTLÜK NOTU: Bu script bu sandbox'ta ÇALIŞTIRILMADI — gerçek bir
-- Supabase/Postgres projesi ve iki farklı authenticated kullanıcı oturumu
-- gerektirir (auth.uid() gerçek bir JWT'den gelir). Bu yüzden Final
-- Verification raporunda "RLS: NOT VERIFIED" olarak işaretlenmiştir.
--
-- Gerçek deployment sonrası, Supabase SQL Editor'de veya bir test scriptinde
-- (örn. Supabase CLI `supabase test db`) şu adımlarla ÇALIŞTIRILMALIDIR:
--
-- 1) İki gerçek kullanıcı oluşturun (User A, User B), ikisini de aynı
--    family_id'ye family_members olarak ekleyin.
-- 2) User A olarak (onun JWT'siyle) bir income kaydı oluşturun.
-- 3) User B olarak (RLS test) aşağıdaki senaryoları çalıştırın:
-- ============================================================================

-- SENARYO 1 — User B, User A'nın income kaydını UPDATE etmeye çalışır.
-- BEKLENEN SONUÇ: 0 satır etkilenir (RLS engelliyor), hata değil ama
-- etkilenen satır sayısı 0 olmalı.
--
--   set role authenticated;
--   set request.jwt.claims = '{"sub": "<user-b-uuid>"}';
--   update income set amount = 99999 where id = '<user-a-income-id>';
--   -- Expect: UPDATE 0

-- SENARYO 2 — User B, User A'nın income kaydını DELETE etmeye çalışır.
-- BEKLENEN SONUÇ: 0 satır etkilenir.
--
--   delete from income where id = '<user-a-income-id>';
--   -- Expect: DELETE 0

-- SENARYO 3 — User B, kendi ailesine ait olmayan bir family_id'nin
-- income kayıtlarını SELECT etmeye çalışır.
-- BEKLENEN SONUÇ: 0 satır döner.
--
--   select * from income where family_id = '<other-family-uuid>';
--   -- Expect: 0 rows

-- SENARYO 4 — User B, kendi ailesindeki paylaşılan income verisini SELECT
-- eder (User A'nın kaydı dahil).
-- BEKLENEN SONUÇ: satır(lar) döner (okuma serbest, yazma değil).
--
--   select * from income where family_id = '<shared-family-uuid>';
--   -- Expect: rows returned, including User A's row

-- SENARYO 5 — User B, User A'nın credit_cards kaydını SELECT etmeye çalışır.
-- BEKLENEN SONUÇ: 0 satır (credit_cards SADECE sahibine görünür, aile
-- üyeliği bile yetmez — Bölüm: kredi kartı gizliliği).
--
--   select * from credit_cards where user_id = '<user-a-uuid>';
--   -- Expect: 0 rows (even though User A and B share a family)

-- SENARYO 6 — Herhangi bir authenticated kullanıcı, vehicles tablosuna
-- doğrudan INSERT denemesi yapar (4. araç ekleme girişimi dahil).
-- BEKLENEN SONUÇ: RLS INSERT policy'si olmadığı için reddedilir.
--
--   insert into vehicles (family_id, full_name, short_name)
--   values ('<family-uuid>', 'Fake Car', 'Fake');
--   -- Expect: permission denied for table vehicles (no INSERT policy exists)

-- SENARYO 7 — Aynı family_id'ye 4. bir araç, SERVICE ROLE ile bile eklenmeye
-- çalışılırsa (RLS bypass edilse dahi) trigger seviyesinde reddedilmeli.
--
--   insert into vehicles (family_id, full_name, short_name)
--   values ('<family-with-3-vehicles>', '4. Araç', 'Fake')
--   -- Expect: ERROR: FAMILY_VEHICLE_LIMIT_EXCEEDED

-- ============================================================================
-- Bu senaryoların hiçbiri bu sandbox'ta çalıştırılmadı. Gerçek sonuçlar
-- ancak yukarıdaki adımlar gerçek bir Supabase projesinde uygulandığında
-- elde edilebilir.
-- ============================================================================
