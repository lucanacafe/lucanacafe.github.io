# Lucana Cafe & Lounge

**Cafe · Nargile · Okey** — Çağlayan, Kağıthane / İstanbul

Lucana'nın web sitesi, QR menüsü, masadan sipariş sistemi ve yönetim paneli. Tek bir PWA olarak çalışır; telefona uygulama gibi yüklenebilir.

| | |
|---|---|
| Canlı site | https://lucanacafe.github.io/ |
| Repo | https://github.com/lucanacafe/lucanacafe.github.io |
| Menü | `/menu` |
| Masa (QR) | `/m/<masa-kodu>` |
| Yönetim paneli | `/panel` |

**Teknolojiler:** React 18 + TypeScript · Vite · Tailwind CSS · Framer Motion · Supabase (Postgres + Realtime + Storage + Edge Functions) · vite-plugin-pwa · GitHub Pages

---

## Özellikler

### Müşteri tarafı
- **Ana sayfa:** Instagram görsellerinden oluşturulan tema (gece siyahı, pirinç/altın, bordo, köz turuncusu), canlı "şu an açık" rozeti, galeri, harita, iletişim.
- **Menü (`/menu`):** kategori sekmeleri, Türkçe karakter duyarsız arama, ürün detayları, "tükendi" durumu. Çevrimdışıyken son menü önbellekten gösterilir.
- **QR masa sayfası (`/m/<kod>`):**
  - Sepet, ürün notu, sipariş notu → tek dokunuşla sipariş
  - Siparişi canlı takip (Yeni → Hazırlanıyor → Servis edildi), durum değişince bildirim
  - Hızlı çağrılar: **Garson çağır · Köz değişimi · Hesap iste**
  - Onaylanmamış siparişi 2 dk içinde iptal
  - Wi-Fi bilgisi (yalnızca QR okutanlara)

### Üyelik, puan ve sosyal özellikler
- **Tek dokunuşla üyelik:** Masadaki QR okutulunca açılan ekranda tek onay kutusu (18+, Kullanım Koşulları, KVKK Aydınlatma Metni, Puan & Oyun Koşulları) → "Başla". Rastgele takma ad, form/şifre yok. Kampanya bildirimleri ayrı ve isteğe bağlı açık rıza.
- **Çift hesap yok:** Geçerli oturum varken sunucu yeni hesap açmaz. İsteğe bağlı kullanıcı adı + şifre ile hesap "kaydedilir"; başka cihazdan girişte o cihazdaki boş anonim hesap silinir.
- **Sadakat puanı (BigLoft modeli, %10 iade):** 1 ₺ NET ödeme = 10 puan, 100 puan = 1 ₺ indirim, sepetin en fazla %50'si. Puan ödenince kazanılır, iptalde harcanan puan iade edilir. Her hareket `points_ledger`'da; (tür, referans) benzersiz → çift kazanım/harcama imkânsız.
- **Sosyal:** Masada kimler var + kim ne sipariş etti, canlı akış (sipariş, masaya oturma, büyük hasat), liderlik tablosu (haftalık, tüm zamanlar, Bahçe, Blok). Görünmez mod.
- **Profil:** Takma ad/simge, puan geçmişi, hesabı kaydet, bildirimler, uygulamayı yükle, KVKK: hesabımı sil.
- **Uyarılar:** Üyelikten sonra "Bildirimleri aç" ve "Ana ekrana ekle" kartları (iPhone için talimat).

### Oyunlar (şans oyunu YOK)
Türkiye mevzuatı gereği (TCK 228) bahis ve sonucu talihe bağlı oyunlar **bilinçli olarak yoktur**:
- **Lucana Bahçesi** (FarmVille tarzı, gerçek piksel sanatı — [josehzz, CC0](https://opengameart.org/content/farming-crops-16x16); ürünlerin 5 büyüme evresi, sürülmüş/ıslak toprak, çimen karoları): tohum ek → sabit süre → sabit hasat. Ürün maliyeti, süresi ve verimi önceden belli. Komşunun büyüyen ürününü sulamak onu %15 hızlandırır, sulayana teşekkür puanı verir. Seviye atladıkça yeni ürünler açılır, puanla yeni tarla alınır.
- **Lucana Blok** (Tetris): beceri oyunu, bahissiz; ödül satır sayısına bağlı.
- **Ödül havuzu:** Oyunların dağıttığı tüm puan admin'in doldurduğu havuzdan çıkar; tohum/tarla bedelleri havuza döner. Kişi başı günlük tavanlar (hasat kârı, sulama, Blok) Ayarlar'dan belirlenir.

### Yönetim paneli (`/panel`)
| Sayfa | İçerik |
|---|---|
| Özet | Günlük ciro, aktif sipariş, dolu masa, açık çağrı, 7 günlük grafik, en çok satanlar, kritik stok |
| Siparişler | Canlı kanban panosu (zil sesi + bildirim), panelden sipariş girme, ödeme, iptal (stok iadeli), gün geçmişi |
| Masalar | Canlı masa haritası, masadaki kişi sayısı ve kimler oturuyor, bekleyen çağrılar, masa hesabını kapatma (nakit/kart) |
| Menü | Kategori/ürün ekle-düzenle, görsel yükleme (otomatik WebP), öne çıkarma, gizleme, sıralama |
| Stok | Depo kalemleri (kömür, tütün, süt…), giriş/çıkış hareketleri, menü ürünü stok takibi, kritik seviye uyarısı |
| Masa & QR | Masa ekle/toplu ekle, QR önizleme/PNG indirme, A4 QR kartı yazdırma, QR yenileme |
| Raporlar | Ciro, ortalama adisyon, QR sipariş payı, günlük grafik, ürün/kategori/ödeme dağılımı, saatlik yoğunluk, CSV dışa aktarma |
| Personel | Hesap açma, rol atama, şifre sıfırlama, pasife alma, tüm oturumları kapatma |
| İşlem geçmişi | Kim, ne zaman, ne yaptı (audit log) |
| Ayarlar | QR siparişi / çağrıları aç-kapa, işletme bilgileri, duyuru bandı, Wi-Fi |
| Üyeler & Puan | Üye listesi, masada olanlar, harcama, puan geçmişi, puan ekle/düş, kısıtla |
| Oyunlar & Havuz | Ödül havuzu bakiyesi, havuza ekle/çek, oyun hareketleri, dağıtılan net puan |
| Hesabım | Şifre değiştirme, **bu cihazda bildirimleri aç/kapat**, test bildirimi |

---

## Güvenlik modeli

BigLoft Yönetim'deki modelin sıkılaştırılmış hâli:

- **Ayrı şema:** Tüm veri `lucana` Postgres şemasında; aynı Supabase projesindeki diğer uygulamalarla çakışmaz.
- **Tablolara sıfır erişim:** Tüm tablolarda RLS açık ve `anon`/`authenticated` rollerinin hiçbir tablo yetkisi yok. Her şey `SECURITY DEFINER` RPC fonksiyonları üzerinden yürür; her fonksiyon yetkiyi kendi içinde kontrol eder.
- **Özel personel kimliği:** Kayıt yok; hesapları yalnızca yetkililer açar. Şifreler `bcrypt` (pgcrypto) ile saklanır.
- **Oturum token'ı:** Girişte 256-bit rastgele token üretilir; veritabanında **yalnızca SHA-256 hash'i** tutulur. İstemci token'ı `x-session-token` header'ı ile gönderir. Oturum 14 gün (kayan) geçerlidir.
- **Brute-force kilidi:** Kullanıcı başına 15 dk'da 5, IP başına 25 hatalı denemede kilit.
- **İlk girişte zorunlu şifre değişimi;** şifre değişince diğer cihazlardaki oturumlar kapanır.
- **Yetki seviyeleri** (sunucuda zorlanır, arayüz yalnızca yansıtır):

  | Rol | Seviye | Yetki |
  |---|---|---|
  | Kurucu | 100 | Her şey |
  | Müdür | 80 | Menü, fiyat, stok tanımları, masa/QR, ayarlar, alt seviye personel |
  | Kasiyer | 60 | Ödeme alma, iptal, ciro raporları |
  | Garson | 40 | Sipariş girme, çağrılar, stok hareketi, ürünü gizleme |
  | Mutfak/Bar | 30 | Sipariş durumunu ilerletme |

- **Müşteri siparişleri:** Fiyatlar her zaman sunucuda hesaplanır; stok satır kilidiyle düşülür. Masa QR'ı gizli bir kod içerir (tahmin edilemez), panelden tek tıkla yenilenebilir. Cihaz başına hız sınırları (15 sn'de 1 sipariş, saatte 12; 10 dk'da 6 çağrı).
- **Realtime:** Sunucu yalnızca veri içermeyen "değişti" sinyali yayınlar; veriler her zaman yetki kontrollü RPC'lerden okunur. Realtime koparsa periyodik yenileme devreye girer.
- **Bildirimler (Web Push / VAPID):** Uygulama veya telefon kapalıyken de çalışır. Personel: yeni QR sipariş (seviye ≥ 30) ve garson/köz/hesap çağrıları (seviye ≥ 40). Müşteri: QR sayfasında izin verirse kendi siparişinin "hazırlanıyor / servis edildi" bildirimi. Olay veritabanında olduğu an `lucana._push` → pg_net → `lucana-push` Edge Function (gizli header ile) → web-push. Ölü abonelikler otomatik silinir; çıkış yapan personelin cihaz aboneliği kaldırılır. iPhone'da yalnızca "Ana Ekrana Ekle" ile yüklenmiş uygulamada çalışır (iOS 16.4+).
- **Görsel yükleme:** `lucana-upload` Edge Function'ı token'ı doğrular (seviye ≥ 80), dosya türü/boyutunu kontrol eder, service role ile yükler. Service key asla tarayıcıya gitmez.
- `anon` anahtarı herkese açıktır; güvenlik bu anahtara değil yukarıdaki kurallara dayanır.

---

## Proje yapısı

```
src/
  app/            App (router), SiteContext (herkese açık ayarlar)
  components/
    ui/           Button, Modal, Switch, Segmented, grafikler, marka (Logo, ikonlar)
    layout/       Site üst/alt bölüm, PWA güncelleyici, ErrorBoundary
    menu/         MenuBrowser (menü + QR masa sayfasında ortak)
  features/
    site/         Ana sayfa, Menü, 404
    table/        QR masa sayfası + sepet
    admin/        Panel: auth, layout, pulse (canlı veri), components/, pages/
  hooks/          useLive (realtime + yenileme), usePwaInstall
  lib/
    api/          public.ts (müşteri RPC'leri), admin.ts (panel RPC'leri)
    supabase.ts   istemci + x-session-token + hata çevirisi
    realtime.ts   konu başına tek kanal
    utils, constants, hours, media
  styles/         Tailwind + tema
  types/
supabase/
  migrations/     0001 çekirdek+auth · 0002 müşteri RPC · 0003 panel RPC · 0004 seed · 0005 push · 0006 üyelik/puan/sosyal · 0007 ödül havuzu + Blok · 0008 üye push · 0009 Bahçe · 0010 Bahçe sprite eşlemesi · 9999 yetkiler
  functions/      lucana-upload (görsel yükleme) · lucana-push (Web Push gönderici)
scripts/
  reset-test-data.sql  test verisini temizler (menü, masa, personel kalır)
  db.mjs          migration / şema açma / bucket / kurucu hesap (Management API)
  gen-icons.py    PWA ikonları + favicon + paylaşım görseli
  build-farm-assets.py  Bahçe sprite atlası + toprak/çimen karoları → public/game/
  postbuild.mjs   GitHub Pages SPA desteği (404.html)
public/images/    Instagram'dan optimize edilmiş görseller (WebP)
```

---

## Geliştirme

```bash
cp .env.example .env     # değerleri doldurun
npm install
npm run dev              # http://localhost:5173/
npm run build
```

### Veritabanı

```bash
node scripts/db.mjs migrate          # tüm migration'lar
node scripts/db.mjs migrate 0005     # yalnızca yeni bir migration (+ yetkiler)
node scripts/db.mjs expose           # lucana şemasını REST API'ye aç (bir kez)
node scripts/db.mjs bucket           # görsel bucket'ı (bir kez)
node scripts/db.mjs bootstrap        # kurucu hesabı (bir kez) → ADMIN_GIRIS.local.txt
node scripts/db.mjs push             # VAPID anahtarları + push yapılandırması (bir kez)
```

Yeni özellik eklerken: `supabase/migrations/0005_xxx.sql` oluşturun. Adı `_` ile başlamayan her yeni fonksiyon `9999_grants.sql` ile otomatik olarak API'ye açılır; iç yardımcıları `_` ile adlandırın.

### Edge Function

```bash
npx supabase functions deploy lucana-upload --no-verify-jwt --use-api --project-ref <PROJE_REF>
npx supabase functions deploy lucana-push   --no-verify-jwt --use-api --project-ref <PROJE_REF>
```

---

## Yayın (GitHub Pages)

`main` dalına her push'ta `.github/workflows/deploy.yml` siteyi derleyip yayınlar. Derleme değişkenleri repo ayarlarındadır (**Settings → Secrets and variables → Actions → Variables**):

| Değişken | Örnek |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (herkese açık anahtar) |
| `VITE_SITE_URL` | `https://lucanacafe.github.io/` |
| `VITE_BASE` | `/` |
| `VITE_VAPID_PUBLIC_KEY` | `B...` (Web Push public key, herkese açık) |

### Özel domain bağlama (ör. `lucanacafe.com`)

1. Domain sağlayıcısında DNS:
   - `A` kayıtları → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` için `CNAME` → `lucanacafe.github.io`
2. `public/CNAME` dosyası oluşturun, içine yalnızca `lucanacafe.com` yazın.
3. Repo değişkeni `VITE_SITE_URL`'i güncelleyin: `https://lucanacafe.com/` (`VITE_BASE` zaten `/`)
4. Repo → Settings → Pages → Custom domain: `lucanacafe.com`, **Enforce HTTPS** açın.
5. Push edin. **QR kartlarını panelden yeniden yazdırın** (QR'lar site adresini içerir).

> İpucu: QR kartlarını domain bağlandıktan sonra basmak, yeniden basım maliyetini önler.

---

## iPhone uyumu

Uygulama `viewport-fit=cover` ile çentik/Dynamic Island altına kadar uzanır; tüm sabit üst barlar `env(safe-area-inset-top)`, alt menüler `env(safe-area-inset-bottom)` kadar boşluk bırakır. Böylece butonlar çentiğin ya da ana ekran çubuğunun altında kalmaz. Bildirimler iPhone'da yalnızca "Ana Ekrana Ekle" ile yüklenmiş uygulamada çalışır (iOS 16.4+).
