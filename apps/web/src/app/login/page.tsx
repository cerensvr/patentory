import Image from 'next/image';

import { sendPasswordReset, signIn, signUp } from './actions';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string; mode?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const register = params.mode === 'register';
  const reset = params.mode === 'reset';

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><Image alt="Patentory" className="brand-logo" height={46} priority src="/patentory-icon.png" width={46} />Patentory</div>
        <div>
          <p className="eyebrow">MATERIALS INTELLIGENCE</p>
          <h1>Patentleri tekrar kullanılabilir Ar-Ge bilgisine dönüştürün.</h1>
          <p>Patent PDF’lerini, kimyasal eşleşmelerini, deney tablolarını ve teknik bulguları tek bir güvenli çalışma alanında yönetin.</p>
        </div>
        <small>Özel PDF depolama · Kullanıcı bazlı RLS · Ortak web ve Android kütüphanesi</small>
      </section>
      <section className="auth-panel">
        <form action={reset ? sendPasswordReset : register ? signUp : signIn} className="auth-form">
          <p className="eyebrow">{reset ? 'HESAP KURTARMA' : register ? 'YENİ ÇALIŞMA ALANI' : 'HOŞ GELDİNİZ'}</p>
          <h2>{reset ? 'Şifrenizi yenileyin' : register ? 'Patent kütüphanenizi oluşturun' : 'Hesabınıza giriş yapın'}</h2>
          {params.error && <p className="form-message error">{params.error}</p>}
          {params.message && <p className="form-message success">{params.message}</p>}
          {reset && <p className="auth-helper">Hesabınıza bağlı e-posta adresine güvenli bir yenileme bağlantısı göndereceğiz.</p>}
          {register && <label>Adınız<input name="display_name" maxLength={160} autoComplete="name" /></label>}
          <label>E-posta<input name="email" type="email" required autoComplete="email" /></label>
          {!reset && <label>Şifre<input name="password" type="password" minLength={8} required autoComplete={register ? 'new-password' : 'current-password'} /></label>}
          {!reset && !register && params.next && <input name="next" type="hidden" value={params.next} />}
          <button className="primary-action" type="submit">{reset ? 'Yenileme bağlantısı gönder' : register ? 'Hesap oluştur' : 'Giriş yap'}</button>
          <a href={reset || register ? '/login' : '/login?mode=register'}>{reset || register ? 'Giriş ekranına dön' : 'Yeni misiniz? Hesap oluşturun'}</a>
          {!register && !reset && <a href="/login?mode=reset">Şifremi unuttum</a>}
          <a href="/privacy">Gizlilik politikası</a>
        </form>
      </section>
    </main>
  );
}
