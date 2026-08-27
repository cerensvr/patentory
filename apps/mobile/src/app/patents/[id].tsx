import type { Database, Json } from '@patent-knowledge/supabase/database.types';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/palette';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Patent = Database['public']['Tables']['patents']['Row'];
type Material = { id: string; name: string; role: string };
type AnalysisRun = Database['public']['Tables']['ai_analysis_runs']['Row'];
type AnalysisSuggestion = Database['public']['Tables']['ai_analysis_suggestions']['Row'];
type PerformanceMetric = { name: string; value: string; unit: string | null; context: string; page: number | null };
type AnalysisResult = { performance_metrics?: PerformanceMetric[] };

export default function PatentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [patent, setPatent] = useState<Patent>();
  const [categories, setCategories] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [signedUrl, setSignedUrl] = useState<string>();
  const [title, setTitle] = useState('');
  const [patentNumber, setPatentNumber] = useState('');
  const [assignee, setAssignee] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);
  const [suggestions, setSuggestions] = useState<AnalysisSuggestion[]>([]);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const [patentResult, categoryResult, purposeResult, materialResult, runResult] = await Promise.all([
      supabase.from('patents').select('*').eq('id', id).eq('owner_user_id', session.user.id).maybeSingle(),
      supabase.from('patent_application_categories').select('application_categories(name)').eq('patent_id', id),
      supabase.from('patent_technical_purposes').select('technical_purposes(name)').eq('patent_id', id),
      supabase.from('patent_chemicals').select('id,raw_material_name,chemicals(canonical_name,abbreviation),commercial_products(trade_name),chemical_roles(name)').eq('patent_id', id),
      supabase.from('ai_analysis_runs').select('*').eq('patent_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (patentResult.error || !patentResult.data) { Alert.alert('Patent bulunamadı', patentResult.error?.message); router.back(); return; }
    const item = patentResult.data;
    setPatent(item); setTitle(item.title ?? ''); setPatentNumber(item.patent_number ?? ''); setAssignee(item.assignee ?? ''); setSummary(item.user_summary ?? ''); setNotes(item.notes ?? '');
    setCategories(categoryResult.data?.flatMap((row) => row.application_categories?.name ? [row.application_categories.name] : []) ?? []);
    setPurposes(purposeResult.data?.flatMap((row) => row.technical_purposes?.name ? [row.technical_purposes.name] : []) ?? []);
    setMaterials(materialResult.data?.map((row) => ({ id: row.id, name: row.chemicals?.abbreviation || row.chemicals?.canonical_name || row.commercial_products?.trade_name || row.raw_material_name || 'Malzeme', role: row.chemical_roles?.name ?? 'Rol yok' })) ?? []);
    setAnalysisRun(runResult.data);
    if (runResult.data) {
      const suggestionResult = await supabase.from('ai_analysis_suggestions').select('*').eq('run_id', runResult.data.id).order('confidence_score', { ascending: false });
      setSuggestions(suggestionResult.data ?? []);
    } else setSuggestions([]);
    if (item.pdf_storage_path) {
      const result = await supabase.storage.from('patent-pdfs').createSignedUrl(item.pdf_storage_path, 900);
      setSignedUrl(result.data?.signedUrl);
    }
  }, [id, router, session]);

  // Data is resolved asynchronously and then synchronized into the screen state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!patent || !session) return; setBusy(true);
    const { error } = await supabase.from('patents').update({ title: title.trim() || null, patent_number: patentNumber.trim() || null, assignee: assignee.trim() || null, user_summary: summary.trim() || null, notes: notes.trim() || null }).eq('id', patent.id).eq('owner_user_id', session.user.id);
    setBusy(false); if (error) Alert.alert('Kaydedilemedi', error.message); else Alert.alert('Kaydedildi', 'Patent bilgileri güncellendi.');
  };
  const toggleFavorite = async () => {
    if (!patent || !session) return; const next = !patent.favorite;
    const { error } = await supabase.from('patents').update({ favorite: next }).eq('id', patent.id).eq('owner_user_id', session.user.id);
    if (!error) setPatent({ ...patent, favorite: next });
  };
  const analyze = async () => {
    if (!patent?.pdf_storage_path) { Alert.alert('PDF gerekli', 'AI taraması için önce bir patent PDF’si yükleyin.'); return; }
    setAnalysisBusy(true);
    const { data, error } = await supabase.functions.invoke('analyze-patent', { body: { patentId: patent.id } });
    setAnalysisBusy(false);
    if (error || data?.error) Alert.alert('Tarama tamamlanamadı', String(data?.error ?? error?.message ?? 'Bilinmeyen hata'));
    else { Alert.alert('Tarama tamamlandı', 'Bulguları doğrulayıp kütüphaneye ekleyebilirsiniz.'); await load(); }
  };
  const reviewSuggestion = async (item: AnalysisSuggestion, decision: 'ACCEPTED' | 'REJECTED') => {
    setAnalysisBusy(true);
    const { data, error } = await supabase.functions.invoke('review-ai-suggestion', { body: { suggestionId: item.id, decision } });
    setAnalysisBusy(false);
    if (error || data?.error) Alert.alert('Öneri işlenemedi', String(data?.error ?? error?.message)); else await load();
  };
  const remove = () => Alert.alert('Patenti sil', 'Patent ve özel PDF kalıcı olarak silinecek.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: async () => {
    if (!patent || !session) return; setBusy(true); if (patent.pdf_storage_path) await supabase.storage.from('patent-pdfs').remove([patent.pdf_storage_path]);
    const { error } = await supabase.from('patents').delete().eq('id', patent.id).eq('owner_user_id', session.user.id); if (error) { Alert.alert('Silinemedi', error.message); setBusy(false); } else router.replace('/');
  } }]);

  if (!patent) return <View style={styles.loading}><ActivityIndicator color={palette.amber} /></View>;
  const analysis = asAnalysis(analysisRun?.result_json);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: patent.patent_number ?? 'Patent detayı' }} />
      <View style={styles.topline}><Text style={styles.badge}>{patent.country_code ?? '—'}</Text><Text style={styles.number}>{patent.patent_number ?? 'PATENT TASLAĞI'}</Text><Pressable onPress={toggleFavorite}><Text style={styles.favorite}>{patent.favorite ? '★' : '☆'}</Text></Pressable></View>
      <Text style={styles.heroTitle}>{patent.title ?? 'Başlıksız patent'}</Text><Text style={styles.meta}>{patent.assignee ?? 'Hak sahibi eklenmedi'}</Text>
      {signedUrl && <Pressable onPress={() => Linking.openURL(signedUrl)} style={styles.pdfButton}><Text style={styles.pdfTitle}>PDF’yi güvenli aç</Text><Text style={styles.pdfMeta}>{patent.pdf_original_filename} · Bağlantı 15 dakika geçerli</Text></Pressable>}
      <View style={styles.aiCard}>
        <View style={styles.aiHeader}><View style={styles.aiHeaderCopy}><Text style={styles.aiEyebrow}>KANITA DAYALI İNCELEME</Text><Text style={styles.cardTitle}>AI patent taraması</Text></View><Text style={styles.aiStatus}>{analysisStatus(analysisRun?.status)}</Text></View>
        <Text style={styles.aiDescription}>İstemler, kimyasallar, ticari ürünler, örnekler ve ölçümler PDF sayfasıyla birlikte çıkarılır. Onayınız olmadan kayıt eklenmez.</Text>
        <Pressable disabled={analysisBusy || !patent.pdf_storage_path || analysisRun?.status === 'PROCESSING'} onPress={analyze} style={[styles.saveButton, (!patent.pdf_storage_path || analysisBusy) && styles.disabled]}><Text style={styles.saveText}>{analysisBusy || analysisRun?.status === 'PROCESSING' ? 'PDF inceleniyor…' : analysisRun ? 'Yeniden tara' : 'AI taramasını başlat'}</Text></Pressable>
        {analysisRun?.status === 'FAILED' && <Text style={styles.aiError}>{analysisRun.error_message ?? 'Son tarama tamamlanamadı.'}</Text>}
        {analysisRun?.executive_summary && <View style={styles.aiReport}><AiSection label="YÖNETİCİ ÖZETİ" text={analysisRun.executive_summary} /><AiSection label="TEKNİK PROBLEM" text={analysisRun.technical_problem} /><AiSection label="ÖNERİLEN ÇÖZÜM" text={analysisRun.proposed_solution} />{analysisRun.novelty_points.length > 0 && <View style={styles.aiSection}><Text style={styles.infoTitle}>YENİLİK NOKTALARI</Text>{analysisRun.novelty_points.map((point) => <Text key={point} style={styles.aiBullet}>• {point}</Text>)}</View>}{analysis?.performance_metrics?.length ? <PerformanceChart metrics={analysis.performance_metrics} /> : null}</View>}
        {suggestions.length > 0 && <View style={styles.suggestionList}><Text style={styles.infoTitle}>YAPILANDIRILMIŞ ÖNERİLER · {suggestions.filter((item) => item.review_status === 'PENDING').length} BEKLİYOR</Text>{suggestions.map((item) => {
          const canAccept = item.suggestion_type === 'APPLICATION_CATEGORY' ? Boolean(item.matched_category_id) : item.suggestion_type === 'TECHNICAL_PURPOSE' ? Boolean(item.matched_purpose_id) : Boolean(item.matched_role_id);
          return <View key={item.id} style={[styles.suggestion, item.review_status !== 'PENDING' && styles.reviewedSuggestion]}><View style={styles.suggestionTop}><Text style={styles.suggestionType}>{suggestionType(item.suggestion_type)}</Text><Text style={styles.confidence}>%{Math.round(Number(item.confidence_score ?? 0) * 100)}</Text></View><Text style={styles.suggestionLabel}>{item.label}</Text>{item.evidence_quote && <Text style={styles.evidence}>“{item.evidence_quote}”{item.evidence_page ? ` · PDF s. ${item.evidence_page}` : ''}</Text>}{item.review_status === 'PENDING' ? <View style={styles.reviewButtons}><Pressable disabled={!canAccept || analysisBusy} onPress={() => reviewSuggestion(item, 'ACCEPTED')} style={[styles.reviewButton, !canAccept && styles.disabled]}><Text style={styles.reviewButtonText}>Onayla ve ekle</Text></Pressable><Pressable disabled={analysisBusy} onPress={() => reviewSuggestion(item, 'REJECTED')} style={styles.rejectButton}><Text style={styles.rejectText}>Reddet</Text></Pressable></View> : <Text style={styles.reviewedText}>{item.review_status === 'ACCEPTED' ? 'Onaylandı ve işlendi' : 'Reddedildi'}</Text>}{!canAccept && item.review_status === 'PENDING' && <Text style={styles.catalogWarning}>Katalog eşleşmesi yok; web kataloğunda kayıt oluşturun.</Text>}</View>;
        })}</View>}
        <Text style={styles.aiDisclaimer}>AI çıktısı inceleme desteğidir, hukuki görüş değildir. Manuel akış AI kapalıyken de çalışır.</Text>
      </View>
      <View style={styles.card}><Text style={styles.cardTitle}>Patent bilgileri</Text><Field label="Başlık" value={title} onChangeText={setTitle} /><Field label="Patent numarası" value={patentNumber} onChangeText={setPatentNumber} /><Field label="Hak sahibi" value={assignee} onChangeText={setAssignee} /><Field label="Kısa özet" value={summary} onChangeText={setSummary} multiline /><Field label="Notlar" value={notes} onChangeText={setNotes} multiline /><Pressable disabled={busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{busy ? 'İşleniyor…' : 'Değişiklikleri kaydet'}</Text></Pressable></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Yapılandırılmış bilgi</Text><Info title="Uygulamalar" values={categories} /><Info title="Teknik amaçlar" values={purposes} /><View style={styles.info}><Text style={styles.infoTitle}>KİMYASALLAR VE ROLLER</Text><View style={styles.tags}>{materials.map((item) => <View key={item.id} style={styles.material}><Text style={styles.tagText}>{item.name}</Text><Text style={styles.role}>{item.role}</Text></View>)}</View></View></View>
      <Pressable disabled={busy} onPress={remove} style={styles.deleteButton}><Text style={styles.deleteText}>Patenti ve PDF’yi sil</Text></Pressable>
    </ScrollView>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={palette.textMuted} style={[styles.input, multiline && styles.textarea]} multiline={multiline} {...props} /></View>; }
function Info({ title, values }: { title: string; values: string[] }) { return <View style={styles.info}><Text style={styles.infoTitle}>{title.toUpperCase()}</Text><View style={styles.tags}>{values.length ? values.map((value) => <Text key={value} style={styles.tag}>{value}</Text>) : <Text style={styles.empty}>Henüz eklenmedi.</Text>}</View></View>; }
function AiSection({ label, text }: { label: string; text: string | null }) { if (!text) return null; return <View style={styles.aiSection}><Text style={styles.infoTitle}>{label}</Text><Text style={styles.aiBody}>{text}</Text></View>; }
function PerformanceChart({ metrics }: { metrics: PerformanceMetric[] }) {
  const numeric = metrics.flatMap((metric, index) => {
    const value = metricNumber(metric.value);
    return value === null ? [] : [{ ...metric, numericValue: value, key: `${metric.name}-${index}` }];
  });
  const maximumByUnit = new Map<string, number>();
  for (const metric of numeric) {
    const unit = metric.unit?.trim() || 'Sayısal değer';
    maximumByUnit.set(unit, Math.max(maximumByUnit.get(unit) ?? 0, Math.abs(metric.numericValue)));
  }
  return <View style={styles.performanceCard}><View style={styles.performanceHeading}><View><Text style={styles.infoTitle}>OTOMATİK GÖRSELLEŞTİRME</Text><Text style={styles.performanceTitle}>Performans grafiği</Text></View><Text style={styles.performanceCount}>{numeric.length} ölçüm</Text></View>{numeric.length ? numeric.map((metric) => {
    const unit = metric.unit?.trim() || 'Sayısal değer';
    const maximum = maximumByUnit.get(unit) || 1;
    const width = Math.max(3, Math.min(100, Math.abs(metric.numericValue) / maximum * 100));
    return <View key={metric.key} style={styles.performanceRow}><View style={styles.performanceLabel}><Text numberOfLines={1} style={styles.performanceName}>{metric.name}</Text><Text style={styles.performanceValue}>{metric.value}{metric.unit ? ` ${metric.unit}` : ''}</Text></View><View style={styles.performanceTrack}><View style={[styles.performanceBar, { width: `${width}%` }]} /></View><Text style={styles.performanceContext}>{metric.context}{metric.page ? ` · PDF s. ${metric.page}` : ''}</Text></View>;
  }) : <Text style={styles.performanceEmpty}>Sayısal ölçüm yok; metinsel sonuçlar korunuyor.</Text>}</View>;
}
function asAnalysis(value: Json | null | undefined): AnalysisResult | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as AnalysisResult : null; }
function metricNumber(value: string) { const match = value.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/); if (!match) return null; const parsed = Number(match[0].replace(',', '.')); return Number.isFinite(parsed) ? parsed : null; }
function analysisStatus(status?: string) { return ({ PROCESSING: 'İNCELENİYOR', QUEUED: 'SIRADA', REVIEW_REQUIRED: 'ONAY BEKLİYOR', COMPLETED: 'TAMAMLANDI', FAILED: 'BAŞARISIZ' } as Record<string, string>)[status ?? ''] ?? 'TARANMADI'; }
function suggestionType(type: string) { return ({ CHEMICAL: 'KİMYASAL', COMMERCIAL_PRODUCT: 'TİCARİ ÜRÜN', APPLICATION_CATEGORY: 'UYGULAMA', TECHNICAL_PURPOSE: 'TEKNİK AMAÇ' } as Record<string, string>)[type] ?? type; }

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }, content: { gap: 16, padding: 18, paddingBottom: 50, backgroundColor: palette.background },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 }, badge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, fontSize: 10, fontWeight: '800' }, number: { flex: 1, color: palette.textMuted, fontSize: 11, letterSpacing: .5, fontWeight: '700' }, favorite: { color: palette.amber, fontSize: 27 },
  heroTitle: { color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: '700' }, meta: { marginTop: -8, color: palette.textMuted, fontSize: 12 },
  pdfButton: { padding: 17, borderWidth: 1, borderColor: palette.blue, borderRadius: 18, backgroundColor: palette.blueMuted }, pdfTitle: { color: '#D9E2FF', fontSize: 14, fontWeight: '800' }, pdfMeta: { marginTop: 5, color: '#9FB2E8', fontSize: 10 },
  aiCard: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 21, backgroundColor: '#11151C' }, aiHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, aiHeaderCopy: { flex: 1, gap: 5 }, aiEyebrow: { color: '#8498CC', fontSize: 8, letterSpacing: 1.1, fontWeight: '800' }, aiStatus: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, overflow: 'hidden', color: '#B9C8F7', backgroundColor: palette.blueMuted, fontSize: 7, fontWeight: '800' }, aiDescription: { color: palette.textMuted, fontSize: 10, lineHeight: 16 }, disabled: { opacity: .42 }, aiError: { padding: 11, borderRadius: 11, overflow: 'hidden', color: palette.danger, backgroundColor: palette.dangerMuted, fontSize: 10, lineHeight: 15 }, aiReport: { gap: 8 }, aiSection: { gap: 7, padding: 13, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surfaceMuted }, aiBody: { color: '#C3C9D3', fontSize: 10, lineHeight: 16 }, aiBullet: { color: '#C3C9D3', fontSize: 10, lineHeight: 16 }, suggestionList: { gap: 9, paddingTop: 4 }, suggestion: { gap: 8, padding: 13, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 14, backgroundColor: palette.surfaceMuted }, reviewedSuggestion: { opacity: .62 }, suggestionTop: { flexDirection: 'row', justifyContent: 'space-between' }, suggestionType: { color: '#9DAFDF', fontSize: 7, letterSpacing: .6, fontWeight: '800' }, confidence: { color: palette.textMuted, fontSize: 8 }, suggestionLabel: { color: palette.text, fontSize: 12, fontWeight: '800' }, evidence: { padding: 10, borderLeftWidth: 2, borderLeftColor: '#5875BD', color: '#B9C0CC', backgroundColor: '#151C2B', fontSize: 9, lineHeight: 14 }, reviewButtons: { flexDirection: 'row', gap: 7 }, reviewButton: { minHeight: 36, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.blueMuted }, reviewButtonText: { color: '#CAD4F3', fontSize: 9, fontWeight: '800' }, rejectButton: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10 }, rejectText: { color: '#A9B0BC', fontSize: 9, fontWeight: '700' }, reviewedText: { color: '#A9B9E8', fontSize: 9, fontWeight: '700' }, catalogWarning: { color: '#C9A777', fontSize: 8, lineHeight: 12 }, aiDisclaimer: { color: '#737C89', fontSize: 8, lineHeight: 13 },
  performanceCard: { gap: 13, padding: 14, borderWidth: 1, borderColor: '#303A4A', borderRadius: 15, backgroundColor: '#0D131C' }, performanceHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, performanceTitle: { marginTop: 5, color: palette.text, fontSize: 16, fontWeight: '700' }, performanceCount: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, overflow: 'hidden', color: '#B9C8F7', backgroundColor: palette.blueMuted, fontSize: 7, fontWeight: '800' }, performanceRow: { gap: 6 }, performanceLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, performanceName: { flex: 1, color: '#C7CEDA', fontSize: 9, fontWeight: '700' }, performanceValue: { color: '#B9C9FF', fontSize: 9, fontWeight: '800' }, performanceTrack: { height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#202733' }, performanceBar: { height: '100%', borderRadius: 99, backgroundColor: '#5F82E5' }, performanceContext: { color: '#747E8D', fontSize: 7, lineHeight: 11 }, performanceEmpty: { color: palette.textMuted, fontSize: 9 },
  card: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface }, cardTitle: { marginBottom: 2, color: palette.text, fontSize: 19, fontWeight: '700' }, field: { gap: 7 }, label: { color: '#B7BDC8', fontSize: 11, fontWeight: '700' }, input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted }, textarea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  saveButton: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 3, borderRadius: 15, backgroundColor: palette.blue }, saveText: { color: '#F7F9FF', fontSize: 13, fontWeight: '800' },
  info: { gap: 9, paddingTop: 15, borderTopWidth: 1, borderTopColor: palette.border }, infoTitle: { color: palette.textMuted, fontSize: 9, letterSpacing: 1, fontWeight: '800' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, fontSize: 10, fontWeight: '700' }, material: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, backgroundColor: palette.blueMuted }, tagText: { color: '#C8D5FF', fontSize: 10, fontWeight: '800' }, role: { marginTop: 2, color: '#8FA4DE', fontSize: 8 }, empty: { color: palette.textMuted, fontSize: 11 },
  deleteButton: { height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5A3430', borderRadius: 15, backgroundColor: palette.dangerMuted }, deleteText: { color: palette.danger, fontSize: 12, fontWeight: '800' },
});
