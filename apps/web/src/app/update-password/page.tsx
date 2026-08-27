import { redirect } from 'next/navigation';

import { updateRecoveredPassword } from '@/app/login/actions';
import { createClient } from '@/lib/supabase/server';

type Props = { searchParams: Promise<{ error?: string }> };

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=Şifre yenileme bağlantısını tekrar açın.');
  const params = await searchParams;
  return <main className="auth-panel standalone-auth"><form action={updateRecoveredPassword} className="auth-form"><p className="eyebrow">HESAP GÜVENLİĞİ</p><h2>Yeni şifrenizi belirleyin</h2>{params.error && <p className="form-message error">{params.error}</p>}<label>Yeni şifre<input autoComplete="new-password" minLength={8} name="password" required type="password" /></label><label>Yeni şifre tekrar<input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label><button className="primary-action" type="submit">Şifreyi kaydet</button></form></main>;
}
