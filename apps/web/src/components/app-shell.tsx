import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { signOut } from '@/app/actions';

export function AppShell({ children, email }: { children: ReactNode; email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/">
          <Image alt="Patentory" className="brand-logo" height={42} priority src="/patentory-icon.png" width={42} />
          <div><strong>Patentory</strong><span>Materials intelligence</span></div>
        </Link>
        <nav className="main-nav" aria-label="Ana menü">
          <Link className="active" href="/"><span>⌂</span>Patent kütüphanesi</Link>
          <Link href="/?favorites=1"><span>☆</span>Favoriler</Link>
          <Link href="/chemicals"><span>◇</span>Kimyasal kataloğu</Link>
          <Link href="/patents/new"><span>＋</span>Patent ekle</Link>
          <Link href="/settings"><span>⚙</span>Hesap ve güvenlik</Link>
        </nav>
        <div className="profile-chip">
          <span className="avatar">{initials}</span>
          <div><strong>{email}</strong><span>Kişisel çalışma alanı</span></div>
          <form action={signOut} className="logout-form">
            <button type="submit"><span aria-hidden="true">↗</span>Çıkış yap</button>
          </form>
        </div>
      </aside>
      <section className="content-area">{children}</section>
    </main>
  );
}
