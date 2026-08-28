import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/palette';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const updatePassword = async () => {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { Alert.alert('Şifreyi kontrol edin', 'En az 8 karakter, bir harf ve bir rakam kullanın.'); return; }
    if (password !== confirmation) { Alert.alert('Şifreler eşleşmiyor'); return; }
    setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false);
    if (error) Alert.alert('Şifre güncellenemedi', error.message); else { setPassword(''); setConfirmation(''); Alert.alert('Şifre güncellendi'); }
  };
  const deleteAccount = () => Alert.alert('Hesabı kalıcı sil', 'Tüm patentler, AI analizleri ve özel PDF dosyaları kalıcı olarak silinir.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Hesabı sil', style: 'destructive', onPress: async () => {
    setBusy(true); const { data, error } = await supabase.functions.invoke('delete-account');
    if (error || data?.error) { setBusy(false); Alert.alert('Hesap silinemedi', String(data?.error ?? error?.message)); return; }
    await supabase.auth.signOut({ scope: 'local' }); setBusy(false); router.replace('/');
  } }]);
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/'); };
  const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://patentory.vercel.app/privacy';

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Stack.Screen options={{ title: 'Hesap ve güvenlik' }} /><View style={styles.hero}><Text style={styles.eyebrow}>KİŞİSEL ÇALIŞMA ALANI</Text><Text style={styles.title}>Hesap ve güvenlik</Text><Text style={styles.copy}>{session?.user.email}</Text></View><View style={styles.card}><Text style={styles.cardTitle}>Şifreyi değiştir</Text><TextInput autoCapitalize="none" onChangeText={setPassword} placeholder="Yeni şifre" placeholderTextColor={palette.textMuted} secureTextEntry style={styles.input} value={password} /><TextInput autoCapitalize="none" onChangeText={setConfirmation} placeholder="Yeni şifre tekrar" placeholderTextColor={palette.textMuted} secureTextEntry style={styles.input} value={confirmation} /><Pressable disabled={busy} onPress={updatePassword} style={styles.primary}><Text style={styles.primaryText}>Şifreyi güncelle</Text></Pressable></View><View style={styles.card}><Text style={styles.cardTitle}>Gizlilik ve oturum</Text><Pressable onPress={() => Linking.openURL(privacyUrl)} style={styles.secondary}><Text style={styles.secondaryText}>Gizlilik politikasını aç</Text></Pressable><Pressable onPress={signOut} style={styles.secondary}><Text style={styles.secondaryText}>Oturumu kapat</Text></Pressable></View><View style={[styles.card, styles.dangerCard]}><Text style={styles.cardTitle}>Hesabı kalıcı sil</Text><Text style={styles.copy}>Profil, patentler, notlar, etiketler, AI analizleri ve özel PDF dosyaları geri alınamaz biçimde silinir.</Text><Pressable disabled={busy} onPress={deleteAccount} style={styles.danger}><Text style={styles.dangerText}>{busy ? 'İşleniyor…' : 'Hesabımı ve tüm verilerimi sil'}</Text></Pressable></View></ScrollView>;
}

const styles = StyleSheet.create({ content: { gap: 16, padding: 18, paddingBottom: 50, backgroundColor: palette.background }, hero: { gap: 7, paddingVertical: 8 }, eyebrow: { color: '#8498CC', fontSize: 8, letterSpacing: 1.1, fontWeight: '800' }, title: { color: palette.text, fontSize: 29, fontWeight: '700' }, copy: { color: palette.textMuted, fontSize: 10, lineHeight: 16 }, card: { gap: 13, padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface }, cardTitle: { color: palette.text, fontSize: 18, fontWeight: '700' }, input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted }, primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.blue }, primaryText: { color: '#F7F9FF', fontSize: 12, fontWeight: '800' }, secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 14, backgroundColor: palette.surfaceMuted }, secondaryText: { color: '#C7CEDA', fontSize: 11, fontWeight: '700' }, dangerCard: { borderColor: '#503432' }, danger: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5A3430', borderRadius: 14, backgroundColor: palette.dangerMuted }, dangerText: { color: palette.danger, fontSize: 11, fontWeight: '800' } });
