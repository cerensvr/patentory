import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/palette';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordScreen() {
  const router = useRouter(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { Alert.alert('Şifreyi kontrol edin', 'En az 8 karakter, bir harf ve bir rakam kullanın.'); return; } if (password !== confirmation) { Alert.alert('Şifreler eşleşmiyor'); return; } setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false); if (error) Alert.alert('Şifre güncellenemedi', error.message); else { Alert.alert('Şifre güncellendi'); router.replace('/'); } };
  return <View style={styles.page}><Stack.Screen options={{ title: 'Yeni şifre' }} /><Text style={styles.eyebrow}>HESAP KURTARMA</Text><Text style={styles.title}>Yeni şifrenizi belirleyin</Text><Text style={styles.copy}>En az 8 karakter, bir harf ve bir rakam kullanın.</Text><TextInput onChangeText={setPassword} placeholder="Yeni şifre" placeholderTextColor={palette.textMuted} secureTextEntry style={styles.input} value={password} /><TextInput onChangeText={setConfirmation} placeholder="Yeni şifre tekrar" placeholderTextColor={palette.textMuted} secureTextEntry style={styles.input} value={confirmation} /><Pressable disabled={busy} onPress={submit} style={styles.button}><Text style={styles.buttonText}>{busy ? 'Kaydediliyor…' : 'Şifreyi kaydet'}</Text></Pressable></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, gap: 14, padding: 22, justifyContent: 'center', backgroundColor: palette.background }, eyebrow: { color: '#8498CC', fontSize: 8, letterSpacing: 1.1, fontWeight: '800' }, title: { color: palette.text, fontSize: 29, fontWeight: '700' }, copy: { marginBottom: 7, color: palette.textMuted, fontSize: 11, lineHeight: 17 }, input: { minHeight: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 16, color: palette.text, backgroundColor: palette.surface }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.blue }, buttonText: { color: '#F7F9FF', fontSize: 12, fontWeight: '800' } });
