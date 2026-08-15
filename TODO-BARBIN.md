# BARBİN AİLESİ — YAPILACAKLAR LİSTESİ (Masaüstü Geliştirme Talimatı)

**Proje:** https://barbin.surge.sh
**Backend:** Supabase — `bbxcfkcsivyzscfbarmp.supabase.co`
**Teknoloji:** React + Vite (SPA), Supabase (PostgreSQL + Auth + Realtime), surge.sh deploy
**Hazırlayan:** Devin — canlı uygulamanın tam fonksiyonel testi sonucunda

> Bu dosya, uygulamayı geliştirecek kişiye/yapay zekâya verilmek üzere hazırlandı.
> Maddeler **yapılması gereken sıraya göre** dizildi. Her madde bağımsız olarak uygulanabilir.
> Madde numaraları kalıcıdır; "M1 tamam" şeklinde takip edebilirsiniz.

---

# AŞAMA 1 — KRİTİK HATALAR (önce bunlar, uygulama şu an bunlarda çalışmıyor)

## M1. Kredi kartı ödeme fonksiyonunu düzelt  ⛔ ÖZELLİK TAMAMEN ÇALIŞMIYOR
- **Sorun:** Kart → "Öde" → tutar gir → Kaydet dendiğinde işlem başarısız oluyor.
  Hata: `record "new" has no field "record_date"`
- **Nerede:** Supabase veritabanı — `record_credit_card_payment` fonksiyonu ve ona bağlı trigger.
- **Sebep:** Fonksiyon/trigger içinde `NEW.record_date` alanına erişiliyor, ancak ilgili
  tabloda böyle bir kolon yok (muhtemelen doğrusu `payment_date`).
- **Yapılacak:** Supabase SQL Editor'de `record_credit_card_payment` fonksiyonunun ve
  `credit_card_payments` tablosuna bağlı trigger'ların gövdesini incele; `NEW.record_date`
  referansını tablodaki gerçek kolon adıyla değiştir. Sonra ödeme yapıp
  `credit_cards.current_balance` değerinin azaldığını doğrula.
- **Not:** Bu frontend hatası değildir, veritabanı tarafında düzeltilmelidir.

## M2. `0014` migration'ını canlı veritabanına uygula  ⛔ ÖZELLİK TAMAMEN ÇALIŞMIYOR
- **Sorun:** Hareketler → bir kazanç kaydını Düzenle → Kaydet dendiğinde
  "Veritabanı şeması güncel değil. 0014 migration uygulanmalı." hatası çıkıyor.
  Gerçek hata: `column "mileage_log_id" of relation "income" does not exist`
- **Yapılacak:** Repodaki `0014` numaralı migration dosyasını canlı Supabase veritabanında
  çalıştır (`income.mileage_log_id` kolonunu ekler). Alternatif olarak
  `update_income_with_mileage` RPC'sini bu kolona ihtiyaç duymayacak şekilde yeniden yaz.
- **Doğrulama:** Bir kazanç kaydının tutarını değiştir, `income.amount` ve ilişkili
  `mileage_log` satırının güncellendiğini kontrol et.

## M3. Service worker'ın Supabase yanıtlarını cache'lemesini durdur  ⛔ EN ÇOK KAFA KARIŞTIRAN HATA
- **Sorun:** `public/sw.js` dosyası, Supabase REST `GET` yanıtlarını **cache-first**
  stratejisiyle süresiz saklıyor. Sonuç: kullanıcı kayıt ekleyip silse bile ekranda eski
  veri görünüyor. Kullanıcı işlem çalışmadı sanıp tekrar yapıyor → **mükerrer kayıt**.
- **Etki:** Aşağıdaki özellikler aslında **doğru çalışıyor** ama bu hata yüzünden bozuk
  görünüyor: kazanç ekle/sil, gider ekle/sil, kart ekle/sil, sabit gider ekle/sil,
  randevu ekle/düzenle, profil ayarları.
- **Yapılacak:** `sw.js` içindeki `fetch` handler'ının en başına ekle:
  ```js
  const url = new URL(event.request.url);
  if (url.hostname.endsWith('supabase.co')) return; // asla cache'leme
  ```
  Ayrıca cache adını `barbin-v3` → **`barbin-v4`** yap ki mevcut kullanıcılardaki eski
  cache `activate` sırasında otomatik silinsin.
- **Doğrulama:** Yeni kart ekle → sayfa yenilenmeden listede görünmeli.

## M4. Sabit gider satır içi düzenlemesi veriyi bozuyor  ⛔ VERİ BÜTÜNLÜĞÜ
- **Sorun:** Sabit Giderler ekranında mevcut bir tutarı `100` → `250` yapmaya çalışırken
  veritabanına **`1000`** yazıldı. Her tuş vuruşu ayrı bir `UPDATE` gönderiyor; yazma
  sırasında oluşan ara değerler kaydediliyor.
- **Nerede:** Sabit giderler sayfasındaki tutar input'unun `onChange` handler'ı —
  doğrudan `supabase.from("fixed_expenses").update(...)` çağırıyor.
- **Yapılacak:** Değeri local state'te tut; kaydetmeyi **`onBlur`**, **Enter** veya
  **500 ms debounce** ile tek seferde yap. Bu ayrıca gereksiz backend trafiğini de keser.

## M5. Negatif tutar sessizce pozitife çevriliyor  ⛔ VERİ BÜTÜNLÜĞÜ
- **Sorun:** Kazanç formunda tutar alanına `-50` yazıldığında input `-` karakterini anında
  siliyor, alanda `50` kalıyor ve kullanıcı hiçbir uyarı görmeden **+50** kaydediyor.
- **Nerede:** `onChange: (e) => set(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))`
- **Yapılacak:** `-` karakterinin yazılmasına izin ver; submit anında kontrol et:
  `if (tutar < 0) return hata("Tutar negatif olamaz.")`. Aynı düzeltmeyi gider formuna da uygula.

---

# AŞAMA 2 — ORTA ÖNCELİKLİ HATALAR

## M6. Kart rozeti borç varken "PAID" gösteriyor
- **Sorun:** Bakiye $347 iken kartta yeşil "PAID" rozeti görünüyor. Bileşen `payment_status`
  kolonunu hiç doğrulamadan olduğu gibi basıyor.
- **Yapılacak:** Rozeti **bakiyeden hesapla**: `current_balance <= 0 → "ÖDENDİ"`,
  vade geçmişse `"VADESİ GEÇTİ"`, aksi halde `"ÖDENMEDİ"`. Metinleri Türkçeleştir.

## M7. "gün kaldı" sayacı bir gün şaşıyor
- **Sorun:** Vade 16 Ağustos iken 13 Ağustos'ta "4 gün kaldı" yazıyor (doğrusu 3).
- **Sebep:** Vade `T12:00:00` ile, bugün gece yarısı ile karşılaştırılıp `Math.round` uygulanıyor.
- **Yapılacak:** İki tarafı da gün başlangıcına normalize et:
  ```js
  const gunBasi = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
  const kalan = Math.round((gunBasi(`${due_date}T00:00:00`) - gunBasi(new Date())) / 864e5);
  ```

## M8. SPA fallback yok — derin rotada F5 → 404
- **Sorun:** `/kredi-kartlari` üzerindeyken sayfa yenilenince surge "page not found" veriyor.
  PWA ana ekrana eklendiğinde veya paylaşılan link açıldığında uygulama açılmıyor.
- **Yapılacak:** Build klasörüne `index.html`'in birebir kopyasını **`200.html`** adıyla ekle.
  `package.json` build script'ine ekle: `cp dist/index.html dist/200.html`

## M9. Ham veritabanı hataları kullanıcıya gösteriliyor
- **Sorun:** Kullanıcı `record "new" has no field "record_date"` gibi PostgreSQL hata
  metinleri görüyor.
- **Yapılacak:** Ortak bir `hataMesaji(error)` yardımcısı yaz; bilinen kodları Türkçeleştir,
  bilinmeyenleri "İşlem tamamlanamadı, lütfen tekrar deneyin." mesajına çevir.
  Teknik detay sadece `console.error`'a gitsin.

## M10. Raporlar → Araç Karşılaştırması'nda araç adı yerine ham UUID
- **Sorun:** `654a53c9-c326-449b-8614-cd43780b6924` gibi kimlikler gösteriliyor.
- **Kanıt:** Aynı sayfadaki CSV dışa aktarma "Kia Sportage" adını doğru çözüyor — veri var,
  bileşen `vehicles` tablosuyla eşleştirme yapmıyor.
- **Yapılacak:** `vehicle_id` → `vehicles.short_name` eşlemesi yap; bulunamazsa "Bilinmeyen araç".

## M11. Raporlar → Aile Sıralaması "Bilinmeyen" gösteriyor
- **Sorun:** Aynı bileşen ana ekranda "arif" adını doğru gösteriyor, Raporlar sayfasında
  "Bilinmeyen" düşüyor — sayfa bileşene `profiles` verisini geçirmiyor.
- **Yapılacak:** Ana ekranda kullanılan üye listesini Raporlar sayfasında da bileşene aktar.

## M12. Araçlar ekranında negatif net tutarda eksi işareti yok
- **Sorun:** Zarar, kâr gibi görünüyor.
- **Yapılacak:** Negatif tutarları `−$2,166` biçiminde ve kırmızı göster. (Raporlar sayfası
  bunu doğru yapıyor, Araçlar yapmıyor — ortak `paraFormatla()` yardımcısı kullanılmalı.)

## M13. İptal edilen randevular silinemiyor
- **Sorun:** İptal edilen randevu listede kalıyor, silme seçeneği yok. Hesapta `"a"` ve `"aa"`
  başlıklı iki eski kayıt takılı duruyor.
- **Yapılacak:** İptal edilenlere "Sil" butonu ekle veya varsayılan olarak gizleyip
  "İptal edilenleri göster" filtresi koy.

## M14. Mükerrer kayıt koruması yok
- **Sorun:** Aynı isim/limit/vade ile ikinci kart eklenebiliyor. Hesapta iki adet birebir aynı
  "Amex kamu" kartı var — **toplam borç ($694) gerçekte olduğunun iki katı görünüyor.**
- **Yapılacak:** (a) Hesaptaki fazladan kartı sil. (b) Kaydetmeden önce benzer kayıt kontrolü:
  "Bu isimde bir kart zaten var, yine de eklensin mi?"

---

# AŞAMA 3 — TASARIM: RENK, TİPOGRAFİ, KATMAN SİSTEMİ

> Uygulamanın "eski" görünmesinin üç teknik sebebi: (1) tüm yüzeyler aynı koyulukta —
> katman hiyerarşisi yok, (2) en çok yeri en az bakılan bilgi kaplıyor, (3) renk anlam
> taşımıyor, dekoratif kullanılmış. Aşağıdaki maddeler bu üçünü çözer.

## M15. Renk paletini değiştir — **pembeyi tamamen kaldır**
Tek bir tema dosyası oluştur ve tüm ekranlarda buradan besle:

| Rol | Kod | Kullanım |
|-----|-----|----------|
| Arka plan | `#0A0E1A` | Sayfa zemini |
| Yüzey 1 | `#141926` | Kartlar |
| Yüzey 2 | `#1C2231` | Modal, seçili kart |
| Kenarlık | `rgba(255,255,255,.07)` | Tüm kartlar |
| Vurgu | `#38BDF8` (buz mavisi) | Butonlar, aktif sekme, linkler |
| Gelir | `#10B981` (zümrüt) | Pozitif tutar |
| Gider | `#F43F5E` (mercan) | Negatif tutar — **pembe değil** |
| Uyarı | `#F59E0B` (kehribar) | Yaklaşan vade |
| Altın | `#D4AF37` (şampanya) | Sıralama birincisi, altın kuru |
| Ana metin | `#E8EAF2` | Başlık, tutar |
| İkincil metin | `#8A90A6` | Etiket, açıklama |

**Kaldırılacak:** `#F472B6` pembe her yerden. Mor sadece marka başlığında kalabilir.
Mor→mavi degrade butonlar düz renge çevrilsin.

## M16. "Elit karanlık" görünüm dokunuşları
- Kartların üst kenarına 1 px `rgba(255,255,255,.06)` çizgi → cam kenarı etkisi.
- Sadece birincil butonda hafif parıltı: `box-shadow: 0 0 24px rgba(56,189,248,.18)`.
- Durum kartında %4 opaklıkta durum rengine kaçan degrade zemin (pozitifse yeşil, negatifse kırmızı).
- Tüm tutarlarda `font-variant-numeric: tabular-nums` → rakamlar hizalanır, çok daha profesyonel durur.
- Köşe yuvarlaklığı standart: kart 16 px, buton 12 px, çip 999 px.
- Koyu temada büyük gölge kullanma; kenarlık + zemin farkı yeterli.

## M17. Tek para birimi: **USD**, tek biçimlendirme fonksiyonu
- Tek bir `paraFormatla(tutar)` yardımcısı:
  `Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits: 0 })`
- **Büyük tutarlarda ondalık gösterme:** `$6,500` (❌ `$6,500.00`). Ondalık yalnızca ödeme
  ve işlem detay ekranlarında.
- Kur widget'ı **hariç** uygulamada hiçbir yerde `₺` olmasın.
- Tarihler `tr-TR` biçiminde: `12 Ağustos 2026` (❌ `2026-08-12`).
- **Opsiyonel:** Tutara uzun basınca güncel kurla TL karşılığı baloncukta görünsün.

---

# AŞAMA 4 — ANA EKRAN YENİDEN DÜZENİ

## M18. Kur widget'ını küçült, başlığın sağ ucuna al
- Şu an ekranın tam genişliğinde bir şerit — devamlı bakılmayan bilgi için en değerli alanı işgal ediyor.
- Yeni hali: başlık satırının sağ ucunda tek satırlık mini çip →
  `$ 47,78 ⌃ · 🪙 10.781 ●` (11–12 px, `#8A90A6`, ikon 12 px).
- Yanında günlük değişim yönünü gösteren küçük yeşil/kırmızı üçgen.
- Çipe dokununca alttan panel açılsın: USD/TRY, EUR/TRY, gram altın, çeyrek altın, son güncelleme saati.
- "canlı" yazısı yerine yanıp sönen 6 px yeşil nokta.

## M19. Durum kartı: "Artıdayız" solda, "Aylık Trend" sağda
Tek kart, iki sütun, toplam yükseklik ~120 px:
```
[ Bugün ] [ Bu Hafta ] [ Bu Ay ]
ARTIDAYIZ                │  AYLIK TREND
+$1,240                  │  ▁▂▄▆█   ↗ %18
Gelir 3.400·Gider 2.160  │  Geçen ay $1.050
```
- Sol: durum kelimesi küçük ve harf aralıklı, tutar **32–36 px** (şu anki ~48 px'ten küçük).
- Sağ: son 6 ayın sparkline grafiği (30 px yükseklik, tek renk çizgi + yumuşak dolgu),
  yanında yüzde değişim ve ok. Yukarı yeşil, aşağı kırmızı.
- Sekme değişince **iki sütun da** güncellensin (Bugün → trend son 7 gün, Bu Ay → son 6 ay).

## M20. Sıralama şeridi: Günün / Haftanın / Ayın 1.'si tek satırda, yukarıda
- Şu an sayfanın çok altında, üç büyük emoji kutusu halinde (🏆🥇👑) — oyuncak hissi veriyor.
- Yeni hali: `Bugün —  ·  Hafta ◉arif $1  ·  Ay ◉arif $1` tek satır, isim yanında 20 px
  baş harf avatarı, lider olanın adı şampanya rengi ince kenarlıkla.
- Emojiler yerine ince çizgi ikonlar (emoji her telefonda farklı görünür, arayüzü ucuzlatır).
- Konum: durum kartının hemen altı.

## M21. "Yaklaşan 7 Gün" kartı ekle  ⭐ EN ÇOK DEĞER KATACAK YENİ ÖZELLİK
Kart vadesi + sabit gider + randevu **tek listede**, tarihe göre sıralı:
```
YAKLAŞAN 7 GÜN                            toplam $387
🟠 27 Ağu  Amex kamu — asgari      $40   [Öde]
⚪ 01 Eyl  Kira                   $6,500
⚪ 03 Eyl  Muayene randevusu         —
```
Satırdaki `[Öde]` butonu doğrudan ödeme modalini açsın.

## M22. Ana ekranı özet yap, arşiv yapma
- Şu an her bölümün **tam listesi** alt alta basılıyor, sayfa gereksiz uzuyor.
- Her bölüm **en fazla 2–3 satır** göstersin, gerisi "Tümünü Gör ›" ile ilgili sayfaya gitsin.
- Haftalık hedef bölümünü tek satıra indir: `████████░░░░ %63 · $2,640/$4,200 · $1,560 kaldı`

## M23. Hızlı ekleme butonu (FAB)
- Sağ altta sabit `+` yuvarlak buton; dokununca yukarı açılan üç seçenek:
  **Kazanç · Gider · Kart Ödemesi**.
- Şu an kazanç eklemek 3 adım sürüyor, tek dokunuşa insin.

---

# AŞAMA 5 — SAYFA YAPISI

## M24. Alt menüyü 7 sekmeden 5 sekmeye indir
Mobilde 7 sekme hem dar hem karışık. Önerilen yapı:

| Sekme | İçeriği |
|-------|---------|
| **Ana** | Dashboard |
| **Kartlar** | Kredi kartları + borç özeti |
| **➕** (ortada, vurgulu) | Hızlı ekleme |
| **Raporlar** | Raporlar + Hareketler + CSV |
| **Profil** | Ayarlar + Araçlar + Randevular + Bildirimler + Sabit Giderler |

## M25. `/raporlar` sayfasını menüye ekle
- Sayfa **çalışıyor** (finansal özet, aylık trend, üç ayrı CSV dışa aktarma — hepsi doğru)
  ama alt menüde bağlantısı **yok**, kullanıcı varlığından haberdar değil.
- Uygulamanın en değerli sayfası; mutlaka menüye alınmalı.

## M26. Hareketler sayfasına filtre ve arama ekle
- Şu an düz liste; kayıt sayısı arttıkça kullanılamaz hale gelecek.
- Gerekenler: tarih aralığı, kategori, araç filtresi, metin araması ve üstte
  "filtrelenmiş toplam" satırı. Uzun listelerde tarih başlıkları yapışkan (sticky) olsun.

## M27. Kredi kartını gerçek karta benzet
- Gerçek kart oranında (1.586:1) yüzey, sağ üstte banka rengi/logosu (kullanıcı seçer),
  altta `•••• 1234`.
- Limit çubuğu kartın alt kenarında ince şerit: %30'a kadar yeşil, %70'e kadar kehribar,
  üzeri kırmızı.
- **"Asgari Öde" / "Tamamını Öde"** hızlı butonları — tutarı elle yazmaya gerek kalmasın.
- Karta dokununca ödeme geçmişi açılsın.

---

# AŞAMA 6 — KULLANIM DENEYİMİ CİLASI

## M28. İşlem geri bildirimi (spinner + toast)
- Kaydet'e basınca ne yükleniyor göstergesi ne başarı mesajı var. Yavaş bağlantıda kullanıcı
  ikinci kez basıyor → **mükerrer kayıt** (hesabınızdaki çift "Amex kamu" büyük ihtimalle böyle oluştu).
- Gönderim sırasında butonu devre dışı bırak + spinner göster; başarıda kısa toast.

## M29. Boş durum (empty state) ekranları
- Bildirimler sayfası bomboş — kullanıcı "bozuk mu, yükleniyor mu?" diye düşünüyor.
- Her boş liste için: küçük ikon + "Henüz bildiriminiz yok" + ilgili aksiyon butonu.

## M30. Gider düzenlemede `window.prompt()` kullanımını kaldır
- Tarayıcının yerleşik prompt kutusu mobil PWA'da hem çirkin duruyor hem klavye deneyimi bozuk.
- Uygulamanın kendi modalini kullan.

## M31. Tutar alanlarına `inputmode="decimal"` ekle
- Mobilde doğrudan sayı klavyesi açılsın. Türkçe ondalık ayırıcıya (virgül) izin ver.

## M32. Tutar alanlarına makul üst sınır koy
- `999999999999` gibi değerler hiçbir uyarı olmadan kabul ediliyor; yanlışlıkla fazla sıfır
  yazan kullanıcı tüm aylık özeti bozabiliyor.
- Üst sınır (örn. 1.000.000) aşıldığında "Bu tutar çok yüksek görünüyor, emin misiniz?" onayı.

## M33. Silme işlemine "Geri Al" imkânı
- Silmeden sonra 5 saniyelik "Geri Al" toast'ı, ya da kartı silmek yerine arşivleme.

## M34. Küçük dokunuşlar
- Sayfalar arası 150 ms yumuşak geçiş animasyonu.
- İngilizce metinleri Türkçeleştir: `PAID` → `ÖDENDİ`, `CARD` → `KART`.
- Uygulama ikonu ve açılış (splash) ekranını markayla uyumlu hale getir — PWA ana ekrana
  eklendiğinde ilk izlenim burada oluşuyor.

---

# AŞAMA 7 — YENİ ÖZELLİKLER

## M35. Vade hatırlatma bildirimleri
- `notifications` tablosu ve bildirim altyapısı **zaten var ama tamamen boş, hiç kullanılmıyor.**
- Kart vadesine **3 gün** ve **1 gün** kala otomatik bildirim üret.
- Yazılmış altyapının karşılığını almanın en ucuz yolu.

## M36. Kategori bazlı bütçe limiti
- "Benzine ayda $400" gibi limit tanımlanabilsin; %80'e gelince bildirim, aşınca kırmızı uyarı.
- Sabit gider altyapısı mevcut, üzerine kurulması kolay.

## M37. Tekrarlayan kayıt şablonları
- Kira, sigorta, kredi taksiti her ay elle giriliyor.
- "Her ayın 1'inde otomatik oluştur" seçeneği hem zaman kazandırır hem unutmayı engeller.

## M38. Haftalık özet bildirimi
- Her pazar akşamı: "Bu hafta $1.240 kazandın, hedefin %63'ü. Geçen haftaya göre +%18."
- Uygulamayı açmayan kullanıcıyı geri getiren en etkili özellik.

---

# UYGULAMA SIRASI ÖZETİ

| Öncelik | Maddeler | Açıklama |
|---------|----------|----------|
| 1 | **M1–M5** | Kritik hatalar — uygulama şu an temel işlevlerinde çalışmıyor |
| 2 | **M15–M17** | Renk/katman/para birimi sistemi — tek merkezden değişir, tüm ekranları aynı anda modernleştirir |
| 3 | **M18–M23** | Ana ekran yeniden düzeni — kullanıcının ana talebi |
| 4 | **M6–M14** | Orta öncelikli hatalar |
| 5 | **M24–M27** | Sayfa yapısı sadeleştirme |
| 6 | **M28–M34** | Kullanım deneyimi cilası |
| 7 | **M35–M38** | Yeni özellikler |

**Not:** 2. ve 3. adım birlikte yapılırsa uygulama tek seferde tamamen farklı görünür.

---

# TEST EDİLEMEYEN KONULAR (düzeltmelerden sonra kontrol edilmeli)

1. Kart borcundan büyük tutar ödenirse bakiye negatife düşüyor mu — M1 çözülmeden test edilemedi.
2. Kazanç düzenlemesi sonrası kilometre (mileage) senkronu — M2 çözülmeden test edilemedi.
3. Geçmiş tarihli randevu için "gecikmiş" gösterimi — kısmen incelendi.
4. Kapanış mili geriye giderse hata veriyor mu.
5. Push bildirimi gönderimi — `notifications` tablosu boş olduğu için test edilemedi.

---

# DOĞRU ÇALIŞAN VE BOZULMAMASI GEREKEN ÖZELLİKLER

Aşağıdakiler test edildi ve **doğru çalışıyor** — değişiklik yaparken bozulmadıklarından emin olun:

- Ana ekran Bugün/Bu Hafta/Bu Ay toplamları (REST verisiyle birebir eşleşti)
- Kazanç ekleme ve silme (silme, ilişkili `mileage_log` satırını da doğru temizliyor)
- Gider ekleme/düzenleme/silme ve "Araç seçimi zorunludur." doğrulaması
- Kart ekleme ve silme
- Randevu ekleme/düzenleme/iptal etme
- Sabit gider ekleme/silme ve negatif değer reddi
- Profil ayarları (ses, konuşma, bildirim toggle'ları) ve haftalık hedef kaydı
- Raporlar sayfasındaki finansal özet ve üç CSV dışa aktarma (araç adları doğru çözülüyor)
- Mobil görünüm 390×844: yatay taşma yok, dokunma alanları 51×50 px (44 px eşiğinin üstünde)
- Konsolda yakalanmamış JavaScript hatası yok
