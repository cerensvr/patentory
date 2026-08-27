import Link from 'next/link';

export default function DeleteAccountPage() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/">← Patentory</Link>
        <p className="eyebrow">HESAP VE VERİ SİLME</p>
        <h1>Hesabınızı kalıcı olarak silin</h1>
        <p>
          Patentory hesabınızı web veya Android uygulamasından doğrudan
          silebilirsiniz. İşlem geri alınamaz.
        </p>
        <h2>Silme adımları</h2>
        <ol>
          <li>Patentory hesabınıza giriş yapın.</li>
          <li>Hesap ve güvenlik ekranını açın.</li>
          <li>“Hesabımı ve tüm verilerimi sil” düğmesine basın.</li>
          <li>Onay metnini girerek işlemi tamamlayın.</li>
        </ol>
        <Link className="legal-action" href="/login?next=/settings">
          Giriş yap ve silme ekranını aç
        </Link>
        <h2>Silinen veriler</h2>
        <p>
          Profiliniz, patent kayıtlarınız, notlarınız, özel ve teknik etiketleriniz,
          sınıflandırmalarınız, AI analizleriniz ve özel depolamadaki patent PDF’leriniz
          kalıcı olarak silinir. Ayrı ve anonim sistem güvenlik kayıtları, geçerli hukuki
          yükümlülükler kapsamında sınırlı süre tutulabilir.
        </p>
        <h2>Saklama süresi</h2>
        <p>
          Uygulama verileri ve özel PDF’ler silme işlemi sırasında kaldırılır. İşlem
          tamamlandığında aynı hesapla bu verilere yeniden erişilemez.
        </p>
      </article>
    </main>
  );
}
