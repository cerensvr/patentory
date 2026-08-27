'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

export function AccountSettings({ email }: { email: string }) {
  const router = useRouter();
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Şifre en az 8 karakter olmalı; harf ve rakam içermelidir.'); return;
    }
    if (password !== confirmation) { setError('Şifreler eşleşmiyor.'); return; }
    setPasswordBusy(true); setError(undefined); setMessage(undefined);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setPasswordBusy(false);
    if (updateError) setError(updateError.message);
    else { setMessage('Şifreniz güncellendi.'); event.currentTarget.reset(); }
  }

  async function deleteAccount() {
    const confirmation = window.prompt('Bu işlem patentleri ve özel PDF’leri kalıcı olarak siler. Devam etmek için SİL yazın.');
    if (confirmation !== 'SİL') return;
    setDeleteBusy(true); setError(undefined); setMessage(undefined);
    const { data, error: invokeError } = await createClient().functions.invoke('delete-account');
    if (invokeError || data?.error) {
      setDeleteBusy(false);
      setError(String(data?.error ?? invokeError?.message ?? 'Hesap silinemedi.'));
      return;
    }
    await createClient().auth.signOut({ scope: 'local' });
    router.replace('/login?message=Hesabınız ve patent verileriniz silindi.');
    router.refresh();
  }

  return (
    <div className="settings-grid">
      <section className="settings-card">
        <p className="eyebrow">HESAP GÜVENLİĞİ</p><h2>Şifreyi değiştir</h2><p>{email}</p>
        {message && <p className="form-message success">{message}</p>}
        {error && <p className="form-message error">{error}</p>}
        <form className="compact-form" onSubmit={updatePassword}>
          <label>Yeni şifre<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
          <label>Yeni şifre tekrar<input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label>
          <button className="primary-action" disabled={passwordBusy} type="submit">{passwordBusy ? 'Güncelleniyor…' : 'Şifreyi güncelle'}</button>
        </form>
      </section>
      <section className="settings-card danger-zone">
        <p className="eyebrow">VERİ KONTROLÜ</p><h2>Hesabı kalıcı sil</h2>
        <p>Profiliniz, patent kayıtlarınız, notlarınız, etiketleriniz, AI analizleri ve özel PDF dosyalarınız silinir. Bu işlem geri alınamaz.</p>
        <button className="danger-action" disabled={deleteBusy} onClick={deleteAccount} type="button">{deleteBusy ? 'Veriler siliniyor…' : 'Hesabımı ve tüm verilerimi sil'}</button>
      </section>
    </div>
  );
}
