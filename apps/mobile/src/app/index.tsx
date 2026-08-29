import type { Database } from '@patent-knowledge/supabase/database.types';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { palette } from '@/lib/palette';
import { useAuth } from '@/providers/auth-provider';

type PatentResult =
  Database['public']['Functions']['search_patents']['Returns'][number];
type ChemicalFilter = { id: string; canonical_name: string; abbreviation: string | null; chemical_class: string | null };

export default function HomeScreen() {
  const { loading, session } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <LibraryScreen userId={session.user.id} />;
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <Image accessibilityLabel="Patentory" source={require('../../assets/images/patentory-icon-v3.png')} style={styles.logo} />
      <ActivityIndicator color={palette.amber} />
    </View>
  );
}

function AuthScreen() {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert('Yapılandırma eksik', 'Expo Supabase ortam değişkenlerini ekleyin.');
      return;
    }
    if (!email.trim() || password.length < 8) {
      Alert.alert('Bilgileri kontrol edin', 'Geçerli bir e-posta ve en az 8 karakterli şifre kullanın.');
      return;
    }

    setSubmitting(true);
    const result = register
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || null } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (result.error) {
      Alert.alert(register ? 'Kayıt başarısız' : 'Giriş başarısız', result.error.message);
    } else if (register && !result.data.session) {
      Alert.alert('E-postanızı kontrol edin', 'Hesabınızı tamamlamak için e-posta adresinizi onaylayın.');
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) { Alert.alert('E-posta gerekli', 'Hesabınıza bağlı e-posta adresini yazın.'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'patentknowledge://update-password' });
    setSubmitting(false);
    if (error) Alert.alert('Bağlantı gönderilemedi', error.message);
    else Alert.alert('E-postanızı kontrol edin', 'Şifre yenileme bağlantısını bu cihazda açın.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.authScreen}
    >
      <View style={styles.authBrand}>
        <Image accessibilityLabel="Patentory" source={require('../../assets/images/patentory-icon-v3.png')} style={styles.logo} />
        <Text style={styles.authEyebrow}>MATERIALS INTELLIGENCE</Text>
        <Text style={styles.authTitle}>Patentory</Text>
        <Text style={styles.authCopy}>
          Kimya ve malzeme patentlerini tekrar kullanılabilir Ar-Ge bilgisine dönüştürün.
        </Text>
      </View>

      <View style={styles.authCard}>
        <Text style={styles.cardTitle}>{register ? 'Kütüphanenizi oluşturun' : 'Tekrar hoş geldiniz'}</Text>
        {register && (
          <TextInput
            autoCapitalize="words"
            onChangeText={setDisplayName}
            placeholder="Adınız"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
            value={displayName}
          />
        )}
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="E-posta adresi"
          placeholderTextColor={palette.textMuted}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor={palette.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <Pressable disabled={submitting} onPress={submit} style={styles.primaryButton}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.primaryButtonText}>{register ? 'Hesap oluştur' : 'Giriş yap'}</Text>
          )}
        </Pressable>
        <Pressable onPress={() => setRegister((value) => !value)}>
          <Text style={styles.authSwitch}>
            {register ? 'Zaten hesabınız var mı? Giriş yapın' : 'Yeni misiniz? Hesap oluşturun'}
          </Text>
        </Pressable>
        {!register && <Pressable onPress={resetPassword}><Text style={styles.authSwitch}>Şifremi unuttum</Text></Pressable>}
      </View>
    </KeyboardAvoidingView>
  );
}

function LibraryScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const [patents, setPatents] = useState<PatentResult[]>([]);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [chemicalFilters, setChemicalFilters] = useState<ChemicalFilter[]>([]);
  const [selectedChemicalIds, setSelectedChemicalIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void supabase.from('chemicals').select('id,canonical_name,abbreviation,chemical_class').order('canonical_name').then(({ data }) => setChemicalFilters(data ?? []));
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    const conceptResult = query.trim()
      ? await supabase.rpc('search_chemical_concepts', { p_query: query.trim(), p_limit: 1 })
      : { data: null };
    const chemicalId = conceptResult.data?.[0]?.chemical_id;
    const filterChemicalIds = [...new Set([...selectedChemicalIds, ...(chemicalId ? [chemicalId] : [])])];
    const { data, error } = await supabase.rpc('search_patents', {
      p_query: chemicalId ? undefined : query.trim() || undefined,
      p_chemical_ids: filterChemicalIds.length ? filterChemicalIds : undefined,
      p_favorite_only: favoritesOnly,
      p_limit: 50,
    });
    setRefreshing(false);

    if (error) Alert.alert('Patentler yüklenemedi', error.message);
    else setPatents(data ?? []);
  }, [favoritesOnly, query, selectedChemicalIds]);

  // The async Supabase loader owns the refresh state for initial and manual loads.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const toggleFavorite = async (patent: PatentResult) => {
    const { error } = await supabase
      .from('patents')
      .update({ favorite: !patent.favorite })
      .eq('id', patent.id)
      .eq('owner_user_id', userId);
    if (error) Alert.alert('Favori güncellenemedi', error.message);
    else void load();
  };

  return (
    <SafeAreaView style={styles.libraryScreen}>
      <View style={styles.libraryHeader}>
        <View style={styles.libraryBrand}>
          <Image accessibilityLabel="Patentory" source={require('../../assets/images/patentory-icon-v3.png')} style={styles.libraryLogo} />
          <View>
            <Text style={styles.libraryEyebrow}>AR-GE ARŞİVİNİZ</Text>
            <Text style={styles.libraryTitle}>Patent kütüphanesi</Text>
          </View>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.profileButton}>
          <Text style={styles.profileButtonText}>CS</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setQuery}
          onSubmitEditing={() => void load()}
          placeholder="Patent veya kimyasal ara…"
          placeholderTextColor={palette.textMuted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        <Pressable onPress={() => void load()} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Ara</Text>
        </Pressable>
      </View>

      <View style={styles.chemicalFilterBlock}>
        <View style={styles.chemicalFilterHeading}><Text style={styles.chemicalFilterLabel}>EPOKSİ KİMYASI</Text><Text style={styles.chemicalFilterHint}>Birlikte bulunması gerekenleri seçin</Text></View>
        <ScrollView horizontal contentContainerStyle={styles.chemicalFilterScroll} showsHorizontalScrollIndicator={false}>
          {selectedChemicalIds.length > 0 && <Pressable onPress={() => setSelectedChemicalIds([])} style={styles.clearChemicalChip}><Text style={styles.clearChemicalText}>Temizle</Text></Pressable>}
          {chemicalFilters.map((chemical) => {
            const selected = selectedChemicalIds.includes(chemical.id);
            return <Pressable key={chemical.id} onPress={() => setSelectedChemicalIds((current) => selected ? current.filter((id) => id !== chemical.id) : [...current, chemical.id])} style={[styles.chemicalFilterChip, selected && styles.chemicalFilterChipSelected]}><Text style={[styles.chemicalFilterChipText, selected && styles.chemicalFilterChipTextSelected]}>{chemical.abbreviation || chemical.canonical_name}</Text><Text numberOfLines={1} style={styles.chemicalFilterClass}>{chemical.chemical_class || 'Kimyasal'}</Text></Pressable>;
          })}
        </ScrollView>
      </View>

      <View style={styles.chips}>
        <Pressable
          onPress={() => setFavoritesOnly(false)}
          style={[styles.chip, !favoritesOnly && styles.chipSelected]}
        ><Text style={[styles.chipText, !favoritesOnly && styles.chipTextSelected]}>Tüm patentler</Text></Pressable>
        <Pressable
          onPress={() => setFavoritesOnly(true)}
          style={[styles.chip, favoritesOnly && styles.chipSelected]}
        ><Text style={[styles.chipText, favoritesOnly && styles.chipTextSelected]}>☆ Favoriler</Text></Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={patents}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl onRefresh={load} refreshing={refreshing} tintColor={palette.blue} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Kütüphaneniz hazır.</Text>
            <Text style={styles.emptyCopy}>Bir patent PDF’si ekleyin; kimyasalları, örnekleri ve test sonuçlarını tek yerde inceleyin.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/patents/${item.id}`)} style={styles.patentCard}>
            <View style={styles.patentTopline}>
              <Text style={styles.countryBadge}>{item.country_code ?? '—'}</Text>
              <Text style={styles.patentNumber}>{item.patent_number ?? 'PATENT TASLAĞI'}</Text>
              <Pressable hitSlop={12} onPress={() => void toggleFavorite(item)}>
                <Text style={styles.favorite}>{item.favorite ? '★' : '☆'}</Text>
              </Pressable>
            </View>
            <Text numberOfLines={2} style={styles.patentTitle}>{item.title ?? 'Başlıksız patent'}</Text>
            <Text numberOfLines={1} style={styles.patentMeta}>{item.assignee ?? 'Hak sahibi eklenmedi'}</Text>
            <View style={styles.materialRow}>
              {item.material_names.slice(0, 4).map((material) => (
                <Text key={material} style={styles.materialTag}>{material}</Text>
              ))}
            </View>
            <Text numberOfLines={2} style={styles.purposeText}>
              {item.technical_purpose_names.join(' · ') || 'Teknik amaç ekleyin'}
            </Text>
          </Pressable>
        )}
      />

      <Pressable onPress={() => router.push('/patents/new')} style={styles.fab}>
        <Text style={styles.fabPlus}>＋</Text><Text style={styles.fabText}>Patent ekle</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, backgroundColor: palette.background },
  logo: { width: 58, height: 58, borderRadius: 18 },
  authScreen: { flex: 1, justifyContent: 'flex-end', backgroundColor: palette.background },
  authBrand: { paddingHorizontal: 28, paddingBottom: 36 },
  authEyebrow: { marginTop: 28, color: palette.amber, fontSize: 11, letterSpacing: 1.8, fontWeight: '700' },
  authTitle: { marginTop: 8, color: palette.text, fontSize: 49, lineHeight: 48, fontWeight: '300' },
  authCopy: { maxWidth: 320, marginTop: 16, color: palette.textMuted, fontSize: 14, lineHeight: 21 },
  authCard: { gap: 13, padding: 26, paddingBottom: 34, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, backgroundColor: palette.surface },
  cardTitle: { marginBottom: 5, color: palette.text, fontSize: 24, fontWeight: '700' },
  input: { height: 54, paddingHorizontal: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted },
  primaryButton: { height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderRadius: 15, backgroundColor: palette.blue },
  primaryButtonText: { color: '#F7F9FF', fontSize: 15, fontWeight: '800' },
  authSwitch: { paddingVertical: 8, color: '#B8C8F4', textAlign: 'center', fontSize: 13, fontWeight: '600' },
  libraryScreen: { flex: 1, backgroundColor: palette.background },
  libraryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, backgroundColor: palette.background },
  libraryBrand: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  libraryLogo: { width: 38, height: 38, borderRadius: 12 },
  libraryEyebrow: { color: palette.amber, fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  libraryTitle: { marginTop: 4, color: palette.text, fontSize: 30, fontWeight: '600' },
  profileButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.borderStrong },
  profileButtonText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 9, padding: 14, paddingBottom: 8, backgroundColor: palette.background },
  searchInput: { height: 48, flex: 1, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surface },
  searchButton: { height: 48, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: palette.blue },
  searchButtonText: { color: '#F7F9FF', fontSize: 12, fontWeight: '800' },
  chemicalFilterBlock: { gap: 8, paddingTop: 5, backgroundColor: palette.background },
  chemicalFilterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  chemicalFilterLabel: { color: '#8498CC', fontSize: 8, letterSpacing: 1, fontWeight: '800' },
  chemicalFilterHint: { color: palette.textMuted, fontSize: 8 },
  chemicalFilterScroll: { gap: 7, paddingHorizontal: 14, paddingBottom: 7 },
  chemicalFilterChip: { width: 116, gap: 3, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: palette.border, borderRadius: 13, backgroundColor: palette.surface },
  chemicalFilterChipSelected: { borderColor: palette.blue, backgroundColor: palette.blueMuted },
  chemicalFilterChipText: { color: '#C3CAD5', fontSize: 10, fontWeight: '800' },
  chemicalFilterChipTextSelected: { color: '#D7E0FF' },
  chemicalFilterClass: { color: '#707A89', fontSize: 7 },
  clearChemicalChip: { alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: '#4B3A3A', borderRadius: 13, backgroundColor: '#24191A' },
  clearChemicalText: { color: '#D3A3A0', fontSize: 9, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: palette.background },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surface },
  chipSelected: { borderColor: palette.blue, backgroundColor: palette.blueMuted },
  chipText: { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#C8D5FF' },
  listContent: { flexGrow: 1, gap: 11, padding: 14, paddingBottom: 100 },
  patentCard: { padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 19, backgroundColor: palette.surface },
  patentTopline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countryBadge: { minWidth: 32, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, textAlign: 'center', fontSize: 9, fontWeight: '800' },
  patentNumber: { flex: 1, color: palette.textMuted, fontSize: 10, letterSpacing: .4, fontWeight: '600' },
  favorite: { color: palette.amber, fontSize: 22 },
  patentTitle: { marginTop: 14, color: palette.text, fontSize: 19, lineHeight: 24, fontWeight: '700' },
  patentMeta: { marginTop: 7, color: palette.textMuted, fontSize: 11 },
  materialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  materialTag: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, fontSize: 10, fontWeight: '700' },
  purposeText: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: palette.border, color: '#AAB1BF', fontSize: 11, lineHeight: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 44 },
  emptyTitle: { color: palette.text, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { marginTop: 8, color: palette.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  fab: { position: 'absolute', right: 18, bottom: 24, height: 54, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 20, borderRadius: 18, backgroundColor: palette.blue, shadowColor: '#000', shadowOpacity: .28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  fabPlus: { color: '#F7F9FF', fontSize: 21 },
  fabText: { color: '#F7F9FF', fontSize: 13, fontWeight: '800' },
});
