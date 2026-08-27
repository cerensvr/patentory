import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { AccountSettings } from '@/components/account-settings';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <AppShell email={user.email ?? 'Kullanıcı'}><main className="settings-page"><div className="settings-heading"><p className="eyebrow">KİŞİSEL ÇALIŞMA ALANI</p><h1>Hesap ve güvenlik</h1><p>Şifrenizi ve Patentory içinde saklanan verileri yönetin.</p></div><AccountSettings email={user.email ?? 'E-posta yok'} /></main></AppShell>;
}
