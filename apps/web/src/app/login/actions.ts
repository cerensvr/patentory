'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (origin?.startsWith('https://') || origin?.startsWith('http://')) {
    return origin.replace(/\/$/, '');
  }

  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  if (host) {
    const protocol = requestHeaders.get('x-forwarded-proto')
      ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export async function signIn(formData: FormData) {
  const email = value(formData, 'email');
  const password = value(formData, 'password');
  const requestedPath = value(formData, 'next');
  const nextPath = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nextQuery = nextPath === '/' ? '' : `&next=${encodeURIComponent(nextPath)}`;
    redirect(`/login?error=${encodeURIComponent(error.message)}${nextQuery}`);
  }
  redirect(nextPath);
}

export async function signUp(formData: FormData) {
  const displayName = value(formData, 'display_name');
  const email = value(formData, 'email');
  const password = value(formData, 'password');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || null } },
  });

  if (error) redirect(`/login?mode=register&error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect('/login?message=E-posta adresinize gelen onay bağlantısını açın.');
  redirect('/');
}

export async function sendPasswordReset(formData: FormData) {
  const email = value(formData, 'email');
  const supabase = await createClient();
  const siteUrl = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  });
  if (error) redirect(`/login?mode=reset&error=${encodeURIComponent(error.message)}`);
  redirect('/login?message=Şifre yenileme bağlantısı e-posta adresinize gönderildi.');
}

export async function updateRecoveredPassword(formData: FormData) {
  const password = value(formData, 'password');
  const confirmation = value(formData, 'confirmation');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) redirect('/update-password?error=Şifre en az 8 karakter olmalı; harf ve rakam içermelidir.');
  if (password !== confirmation) redirect('/update-password?error=Şifreler eşleşmiyor.');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=Şifre yenileme oturumu bulunamadı.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/update-password?error=${encodeURIComponent(error.message)}`);
  redirect('/?message=Şifreniz güncellendi.');
}
