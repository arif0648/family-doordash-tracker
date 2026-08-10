# DEPLOYMENT VE GERÇEK DOĞRULAMA ADIMLARI

Bu proje bu sandbox'ta **ağ erişimi olmadan** yazıldı. Kod tamamdır, ancak
aşağıdaki adımlar gerçek bir ortamda (senin bilgisayarında / Bolt.new'de /
CI pipeline'ında) çalıştırılmadan hiçbir PASS iddiası doğrulanmış sayılmaz.

## 1. Bağımlılıkları kur

```bash
npm install
```

## 2. Supabase projesi kur

```bash
supabase link --project-ref <your-project-ref>
supabase db push   # 0001..0008 migration'ları sırayla uygular
```

`supabase/migrations/0006_seed.sql` içindeki STEP 4 talimatlarını takip
ederek:
1. 3 gerçek aile üyesi hesabı oluştur (gerçek e-posta/şifre — bunlar
   uydurulamaz).
2. Her biri için `family_members` satırı ekle.
3. Gerçek `fixed_expenses` satırlarını ekle (toplam $6,660 olmalı).

## 3. Ortam değişkenleri

```bash
cp .env.example .env
# .env içine gerçek VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_VAPID_PUBLIC_KEY gir
```

## 4. Push notification için (opsiyonel ama spec'te zorunlu)

```bash
npx web-push generate-vapid-keys   # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY üretir
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
supabase functions deploy send-push
```

## 5. Gerçek doğrulama komutları

```bash
npm run typecheck       # gerçek TypeScript kontrolü (node_modules ile)
npm run build            # gerçek production build
npm run test              # vitest — financialEngine, mileage, timezone, csv, component testleri
npm run test:pure         # bu sandbox'ta zaten çalıştırılan 47 saf-mantık testi (npm bağımsız)
```

## 6. RLS doğrulaması

`supabase/tests/rls_manual_test.sql` içindeki 7 senaryoyu, iki gerçek
authenticated kullanıcı JWT'si ile Supabase SQL Editor'de veya
`supabase test db` ile çalıştır.

## 7. Realtime doğrulaması

İki farklı tarayıcı/oturumda (örn. bir normal pencere + bir gizli pencere)
iki farklı aile üyesiyle giriş yap. Birinde Kazanç ekle, diğerinde sayfa
yenilemeden Ana Sayfa'nın güncellendiğini doğrula.

## 8. Push notification doğrulaması

Gerçek bir cihazda bildirim izni ver, başka bir aile üyesi $50 üzeri bir
kazanç/gider eklesin, cihaza push bildirimi gelip gelmediğini doğrula.

---

Bu adımların hiçbiri bu sandbox'ta çalıştırılmadı (ağ erişimi kapalı).
Final Verification Report'taki NOT VERIFIED satırları bu yüzdendir.
