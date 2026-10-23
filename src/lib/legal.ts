// =============================================================
//  Hukuki metinler — TASLAK. Yayından önce bir avukata kontrol
//  ettirin; işletme unvanı/vergi bilgilerini ekleyin.
//  Metin değişirse CONSENT_VERSION'ı (lib/api/member.ts) artırın.
// =============================================================

export interface LegalDoc {
  id: string;
  title: string;
  body: string;
}

const ISLETME = "Lucana Cafe & Lounge (Çağlayan, Vatan Caddesi No:57, Kağıthane/İstanbul)";

export const LEGAL: LegalDoc[] = [
  {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    body: `${ISLETME} ("İşletme") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan şekilde işlemekteyiz.

İŞLENEN VERİLER
• Takma ad ve seçtiğiniz simge (gerçek adınız istenmez)
• İsteğe bağlı: kullanıcı adı ve şifre (şifre geri döndürülemez şekilde şifrelenir)
• Sipariş, masa, puan, bahçe/oyun ve ziyaret bilgileri
• Teknik veriler: cihaz kimliği, IP adresi, bildirim aboneliği

AMAÇLAR
QR menü ve masadan sipariş hizmetinin sunulması, üyeliğin oluşturulması, sadakat (puan) programının ve oyunların (Lucana Bahçesi, Lucana Blok) işletilmesi, kötüye kullanımın önlenmesi, hizmet kalitesinin ölçülmesi ve yasal yükümlülüklerin yerine getirilmesi.

HUKUKİ SEBEPLER
KVKK m.5/2-c (sözleşmenin kurulması ve ifası), m.5/2-ç (hukuki yükümlülük), m.5/2-f (meşru menfaat). Kampanya ve pazarlama bildirimleri yalnızca açık rızanız ile (m.5/1) gönderilir.

AKTARIM
Verileriniz yalnızca hizmetin sunulması için kullanılan altyapı sağlayıcılarıyla (veritabanı/barındırma hizmeti) ve yasal zorunluluk hâlinde yetkili kurumlarla paylaşılır. Altyapı sağlayıcısının sunucuları yurt dışında bulunabilir; bu aktarım KVKK m.9 kapsamındaki güvencelerle yapılır.

SAKLAMA SÜRESİ
Üyeliğiniz devam ettiği sürece; sipariş ve muhasebe kayıtları ilgili mevzuatta öngörülen süre boyunca saklanır.

HAKLARINIZ (KVKK m.11)
Verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz. Hesabınızı ve verilerinizi uygulamadaki Profil → "Hesabımı sil" ile dilediğiniz an silebilirsiniz. Diğer talepleriniz için İşletme'ye başvurabilirsiniz.`,
  },
  {
    id: "kosullar",
    title: "Kullanım Koşulları",
    body: `1. Bu dijital platform ${ISLETME} tarafından misafirlerine QR menü, masadan sipariş, sadakat programı ve eğlence amaçlı oyunlar (şans oyunu içermeyen) sunmak için işletilir.

2. Platformu kullanmak için 18 yaşından büyük olmanız gerekir. Nargile ve tütün ürünleri 18 yaş altına satılmaz.

3. Hesap, QR kodu okutup koşulları onayladığınızda otomatik ve anonim olarak oluşturulur. Hesabınızı kullanıcı adı ve şifre ile kaydederek başka cihazdan erişebilirsiniz. Hesap bilgilerinizin güvenliğinden siz sorumlusunuz.

4. Takma adlar ve görünen bilgiler hakaret, küfür veya yanıltıcı içerik barındıramaz. İşletme uygunsuz takma adları değiştirme ve hesabı kısıtlama hakkını saklı tutar.

5. Siparişler masada veya kasada ödenir. Fiyatlar menüde gösterildiği gibidir; İşletme fiyatları önceden haber vermeksizin güncelleyebilir.

6. Sosyal özellikler: Takma adınız, simgeniz, bulunduğunuz masa ve sipariş ettiğiniz ürünler diğer misafirlere "canlı akış" ve liderlik tablosunda gösterilebilir. Profil → "Görünmez mod" ile bunu dilediğiniz an kapatabilirsiniz.

7. Sistemi manipüle etmeye, hile yapmaya, otomatik araç kullanmaya veya güvenlik açığı aramaya yönelik her türlü girişim yasaktır; tespit hâlinde puanlar iptal edilir ve hesap kapatılır.

8. İşletme platformu ve bu koşulları değiştirme, askıya alma veya sonlandırma hakkını saklı tutar.`,
  },
  {
    id: "puan",
    title: "Puan Programı ve Oyun Koşulları",
    body: `PUAN PROGRAMI
1. Puanlar yalnızca Lucana'da gerçekleştirilen ve ödenen siparişlerin NET tutarı üzerinden kazanılır. Puanla indirim alınan kısımdan tekrar puan kazanılmaz.

2. Puanlar yalnızca Lucana'da sipariş indirimi olarak kullanılabilir. Puanlar nakde çevrilemez, satın alınamaz, satılamaz, başka bir kişiye devredilemez ve para yerine geçmez; bir ödeme aracı değildir.

3. Kazanma ve harcama oranları ile tek siparişte kullanılabilecek en yüksek indirim oranı uygulamada gösterilir; İşletme bu oranları değiştirebilir.

4. İptal edilen siparişte kullanılan puanlar hesaba iade edilir.

OYUNLAR (Lucana Bahçesi ve Lucana Blok)
5. Oyunlar yalnızca eğlence amaçlıdır. Lucana'da şans oyunu, bahis, piyango veya çekiliş YOKTUR: hiçbir oyunda puan yatırılarak talihe bağlı biçimde kaybedilmez ya da katlanmaz.

6. Lucana Bahçesi süreye dayalıdır: her ürünün tohum bedeli, büyüme süresi ve hasat miktarı önceden ve açıkça gösterilir; sonuç rastgele değildir. Komşu bahçelerini sulamak ürünün süresini kısaltır ve sulayana sabit bir teşekkür puanı kazandırır.

7. Lucana Blok bir beceri oyunudur; bahis yoktur, ödül temizlenen satır sayısına göre belirlenir.

8. Oyunlardan kazanılan puanlar İşletme'nin belirlediği ödül havuzundan karşılanır ve günlük tavanlarla sınırlıdır. İşletme oyunları dilediği zaman kapatabilir, tavanları ve ürün değerlerini değiştirebilir. Hata, kesinti veya hile tespitinde ilgili puanlar düzeltilebilir.

9. Program ve oyunlar bir çekiliş, piyango veya kumar niteliği taşımaz; sonucu talihe bağlı bir kazanç ya da kayıp içermez.`,
  },
  {
    id: "cerez",
    title: "Çerez ve Yerel Depolama",
    body: `Bu site reklam veya üçüncü taraf takip çerezi kullanmaz.

Uygulamanın çalışması için cihazınızın tarayıcı deposunda yalnızca şunlar saklanır: üyelik oturum anahtarı, cihaz kimliği (sipariş takibi ve kötüye kullanımı önleme), sepetiniz, menünün çevrimdışı kopyası ve tercihleriniz (ör. kapattığınız uyarılar).

Bu veriler zorunlu işlevsellik içindir. Tarayıcı ayarlarından silebilirsiniz; bu durumda hesabınızın oturumu kapanır (kaydettiyseniz kullanıcı adı ve şifrenizle tekrar girebilirsiniz).`,
  },
];
