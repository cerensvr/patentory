import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/">← Patentory</Link>
        <p className="eyebrow">SON GÜNCELLEME · 28 AĞUSTOS 2026</p>
        <h1>Gizlilik politikası</h1>
        <p>Patentory, patent PDF’lerini ve Ar-Ge notlarını kişisel çalışma alanınızda düzenlemek için tasarlanmıştır.</p>
        <h2>İşlenen veriler</h2>
        <p>Hesap e-postası, profil adı, manuel patent kayıtları, notlar, etiketler, sınıflandırmalar, kimyasal kayıtları ve yüklediğiniz PDF dosyaları işlenir. Uygulama içi patent verileri reklam amacıyla satılmaz.</p>
        <h2>Saklama ve erişim</h2>
        <p>Veriler Supabase PostgreSQL ve özel Supabase Storage alanında tutulur. Row Level Security, oturum açmış kullanıcıyı yalnızca kendi patentlerine, notlarına, analizlerine ve PDF’lerine erişecek biçimde sınırlar. PDF görüntüleme bağlantıları kısa sürelidir.</p>
        <h2>İsteğe bağlı AI taraması</h2>
        <p>Patent taramasını başlattığınızda ilgili PDF, güvenli Edge Function üzerinden Gemini API’ye analiz için iletilir. Anahtarlar hiçbir zaman web veya Android uygulamasına gönderilmez. Ücretsiz Gemini katmanında gönderilen içerik Google tarafından ürün geliştirme amacıyla işlenebilir; bu nedenle yalnızca paylaşmaya yetkili olduğunuz patent belgelerini yükleyin.</p>
        <h2>Hesap silme</h2>
        <p>Web ve Android uygulamalarındaki “Hesap ve güvenlik” ekranından hesabınızı silebilirsiniz. İşlem; profil, patent, not, etiket, AI analizi ve özel PDF dosyalarını kalıcı olarak kaldırır. Ayrıntılı adımlar için <Link href="/delete-account">hesap silme sayfasını</Link> açın.</p>
        <h2>Güvenlik</h2>
        <p>Gemini/OpenAI anahtarları ve Supabase service-role anahtarı istemci uygulamalarına eklenmez. Ayrıcalıklı işlemler kimlik doğrulamalı Supabase Edge Functions üzerinden yürür.</p>
        <h2>İletişim</h2>
        <p>Yayın öncesinde geliştirici destek e-posta adresi ve tüzel veri sorumlusu bilgileri Play Store kaydıyla birlikte bu bölüme eklenecektir.</p>
      </article>
    </main>
  );
}
