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
type PatentExample = {
  example_number: string;
  summary: string;
  chemicals?: string[];
  conditions?: string[];
  composition?: { component: string; amount: string | null; unit: string | null; basis: string | null; role: string | null; page: number | null }[];
  production_steps?: { step_number: string; instruction: string; conditions: string[]; page: number | null }[];
  test_results?: { test_name: string; method: string | null; result: string; unit: string | null; specimen: string | null; page: number | null }[];
  outcome: string;
  page: number | null;
};
type AnalysisResult = {
  patent_metadata?: { abstract?: string | null };
  document_language?: string;
  independent_claims?: { claim_number: string; summary: string; evidence_quote: string; page: number | null }[];
  process_steps?: string[];
  performance_metrics?: PerformanceMetric[];
  examples?: PatentExample[];
  warnings?: string[];
};

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
  const [correctingId, setCorrectingId] = useState<string>();
  const [correctionText, setCorrectionText] = useState('');

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
    const { data, error } = await supabase.functions.invoke('analyze-patent', { body: { patentId: patent.id, preferGemini: true, allowGeminiFallback: true, allowOpenAiFallback: false } });
    setAnalysisBusy(false);
    if (error || data?.error) Alert.alert('Tarama tamamlanamadı', String(data?.error ?? error?.message ?? 'Bilinmeyen hata'));
    else { Alert.alert('Tarama tamamlandı', 'Bulguları doğrulayıp kütüphaneye ekleyebilirsiniz.'); await load(); }
  };
  const reviewSuggestion = async (item: AnalysisSuggestion, decision: 'ACCEPTED' | 'REJECTED', correction?: string) => {
    setAnalysisBusy(true);
    const { data, error } = await supabase.functions.invoke('review-ai-suggestion', { body: { suggestionId: item.id, decision, correction: correction?.trim() || undefined } });
    setAnalysisBusy(false);
    if (error || data?.error) Alert.alert('Öneri işlenemedi', String(data?.error ?? error?.message));
    else {
      setCorrectingId(undefined);
      setCorrectionText('');
      Alert.alert('Öğrenildi', decision === 'ACCEPTED' ? 'Onayınız sonraki taramalarda dikkate alınacak.' : correction?.trim() ? 'Düzeltmeniz kullanıcı hafızanıza kaydedildi.' : 'Öneri yanlış olarak kaydedildi.');
      await load();
    }
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
        <View style={styles.aiHeader}><View style={styles.aiHeaderCopy}><Text style={styles.aiEyebrow}>AKILLI DOKÜMAN ANALİZİ</Text><Text style={styles.cardTitle}>Patent taraması</Text></View><Text style={styles.aiStatus}>{analysisStatus(analysisRun?.status)}</Text></View>
        <Text style={styles.aiDescription}>İstemler, kimyasallar, ticari ürünler, örnekler ve ölçümler PDF sayfasıyla birlikte çıkarılır. Onayınız olmadan kayıt eklenmez.</Text>
        <View style={styles.providerLine}><Text style={styles.providerTitle}>Gemini 3.7 Flash</Text><Text style={styles.providerMeta}>20 tarama/gün · Flash‑Lite yedeği hazır</Text></View>
        <Pressable disabled={analysisBusy || !patent.pdf_storage_path || analysisRun?.status === 'PROCESSING'} onPress={analyze} style={[styles.saveButton, (!patent.pdf_storage_path || analysisBusy) && styles.disabled]}><Text style={styles.saveText}>{analysisBusy || analysisRun?.status === 'PROCESSING' ? 'PDF inceleniyor…' : analysisRun ? 'Yeniden tara' : 'Patent taramasını başlat'}</Text></Pressable>
        {analysisRun?.status === 'FAILED' && <Text style={styles.aiError}>{analysisRun.error_message ?? 'Son tarama tamamlanamadı.'}</Text>}
        {analysisRun?.executive_summary && <View style={styles.aiReport}>
          <View style={styles.qualityRow}><QualityMetric label="KANITLI" value={String(suggestions.length)} /><QualityMetric label="YÜKSEK GÜVEN" value={String(suggestions.filter((item) => Number(item.confidence_score ?? 0) >= .85).length)} /><QualityMetric label="DİL" value={analysis?.document_language ?? '—'} /></View>
          <View style={styles.qualityRow}><QualityMetric label="MODEL" value={providerLabel(analysisRun.model)} /><QualityMetric label="ÜCRETLİ KARŞILIĞI" value={estimatedPaidCostTry(analysisRun)} /></View>
          <AiSection label="YÖNETİCİ ÖZETİ" text={analysisRun.executive_summary} /><AiSection label="TÜRKÇE ABSTRACT" text={analysis?.patent_metadata?.abstract ?? null} /><AiSection label="TEKNİK PROBLEM" text={analysisRun.technical_problem} /><AiSection label="ÖNERİLEN ÇÖZÜM" text={analysisRun.proposed_solution} />
          {analysisRun.novelty_points.length > 0 && <AiList label="YENİLİK NOKTALARI" values={analysisRun.novelty_points} />}
          {analysis?.independent_claims?.length ? <AiList label="BAĞIMSIZ İSTEMLER" values={analysis.independent_claims.map((claim) => `İstem ${claim.claim_number}: ${claim.summary}${claim.page ? ` · PDF s. ${claim.page}` : ''}`)} /> : null}
          {analysis?.process_steps?.length ? <AiList label="PROSES ADIMLARI" values={analysis.process_steps.map((step, index) => `${index + 1}. ${step}`)} /> : null}
          {analysis?.examples?.length ? <ExampleReport examples={analysis.examples} /> : null}
          {analysis?.performance_metrics?.length ? <PerformanceChart metrics={analysis.performance_metrics} /> : null}
          {analysis?.warnings?.length ? <AiList label="ANALİZ UYARILARI" values={analysis.warnings} warning /> : null}
        </View>}
        {suggestions.length > 0 && <View style={styles.suggestionList}><Text style={styles.infoTitle}>YAPILANDIRILMIŞ ÖNERİLER · {suggestions.filter((item) => item.review_status === 'PENDING').length} BEKLİYOR</Text>{suggestions.map((item) => {
          const canAccept = item.suggestion_type === 'APPLICATION_CATEGORY' ? Boolean(item.matched_category_id) : item.suggestion_type === 'TECHNICAL_PURPOSE' ? Boolean(item.matched_purpose_id) : Boolean(item.matched_role_id);
          return <View key={item.id} style={[styles.suggestion, item.review_status !== 'PENDING' && styles.reviewedSuggestion]}>
            <View style={styles.suggestionTop}><Text style={styles.suggestionType}>{suggestionType(item.suggestion_type)}</Text><Text style={styles.confidence}>{confidenceLabel(Number(item.confidence_score ?? 0))} · %{Math.round(Number(item.confidence_score ?? 0) * 100)}</Text></View>
            <Text style={styles.suggestionLabel}>{item.label}</Text>
            {item.evidence_quote && <Text style={styles.evidence}>“{item.evidence_quote}”{item.evidence_page ? ` · PDF s. ${item.evidence_page}` : ''}</Text>}
            {item.review_status === 'PENDING' ? <>
              <View style={styles.reviewButtons}>
                <Pressable disabled={!canAccept || analysisBusy} onPress={() => reviewSuggestion(item, 'ACCEPTED')} style={[styles.reviewButton, !canAccept && styles.disabled]}><Text style={styles.reviewButtonText}>Onayla ve ekle</Text></Pressable>
                <Pressable disabled={analysisBusy} onPress={() => { setCorrectingId(item.id); setCorrectionText(''); }} style={styles.rejectButton}><Text style={styles.rejectText}>Yanlış / düzelt</Text></Pressable>
              </View>
              {correctingId === item.id && <View style={styles.correctionBox}>
                <Text style={styles.correctionTitle}>Bu ifade neyi anlatıyor?</Text>
                <TextInput autoFocus maxLength={500} onChangeText={setCorrectionText} placeholder="Doğru karşılığı yazın" placeholderTextColor={palette.textMuted} style={styles.correctionInput} value={correctionText} />
                <Text style={styles.correctionHelp}>Yalnızca size ait öğrenme hafızasına kaydedilir; kimyasal kataloğu değişmez.</Text>
                <View style={styles.correctionActions}>
                  <Pressable disabled={!correctionText.trim() || analysisBusy} onPress={() => reviewSuggestion(item, 'REJECTED', correctionText)} style={[styles.correctionPrimary, (!correctionText.trim() || analysisBusy) && styles.disabled]}><Text style={styles.correctionPrimaryText}>Düzeltmeyi öğret</Text></Pressable>
                  <Pressable disabled={analysisBusy} onPress={() => reviewSuggestion(item, 'REJECTED')} style={styles.correctionSecondary}><Text style={styles.correctionSecondaryText}>Sadece yanlış</Text></Pressable>
                  <Pressable disabled={analysisBusy} onPress={() => { setCorrectingId(undefined); setCorrectionText(''); }} style={styles.correctionSecondary}><Text style={styles.correctionSecondaryText}>Vazgeç</Text></Pressable>
                </View>
              </View>}
            </> : <Text style={styles.reviewedText}>{item.review_status === 'ACCEPTED' ? 'Onaylandı ve işlendi' : 'Reddedildi'}</Text>}
            {!canAccept && item.review_status === 'PENDING' && <Text style={styles.catalogWarning}>Katalog eşleşmesi yok; doğru karşılığı öğretebilir veya web kataloğunda size özel kayıt oluşturabilirsiniz.</Text>}
          </View>;
        })}</View>}
        <Text style={styles.aiDisclaimer}>Sonuçları kütüphaneye işlemeden önce kaynak sayfasıyla doğrulayın.</Text>
      </View>
      <View style={styles.card}><Text style={styles.cardTitle}>Patent bilgileri</Text><Field label="Başlık" value={title} onChangeText={setTitle} /><Field label="Patent numarası" value={patentNumber} onChangeText={setPatentNumber} /><Field label="Hak sahibi" value={assignee} onChangeText={setAssignee} /><Field label="Türkçe abstract / özet" value={summary} onChangeText={setSummary} multiline /><Field label="Notlar" value={notes} onChangeText={setNotes} multiline /><Pressable disabled={busy} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{busy ? 'İşleniyor…' : 'Değişiklikleri kaydet'}</Text></Pressable></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Yapılandırılmış bilgi</Text><Info title="Uygulamalar" values={categories} /><Info title="Teknik amaçlar" values={purposes} /><View style={styles.info}><Text style={styles.infoTitle}>KİMYASALLAR VE ROLLER</Text><View style={styles.tags}>{materials.map((item) => <View key={item.id} style={styles.material}><Text style={styles.tagText}>{item.name}</Text><Text style={styles.role}>{item.role}</Text></View>)}</View></View></View>
      <Pressable disabled={busy} onPress={remove} style={styles.deleteButton}><Text style={styles.deleteText}>Patenti ve PDF’yi sil</Text></Pressable>
    </ScrollView>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={palette.textMuted} style={[styles.input, multiline && styles.textarea]} multiline={multiline} {...props} /></View>; }
function Info({ title, values }: { title: string; values: string[] }) { return <View style={styles.info}><Text style={styles.infoTitle}>{title.toUpperCase()}</Text><View style={styles.tags}>{values.length ? values.map((value) => <Text key={value} style={styles.tag}>{value}</Text>) : <Text style={styles.empty}>Henüz eklenmedi.</Text>}</View></View>; }
function AiSection({ label, text }: { label: string; text: string | null }) { if (!text) return null; return <View style={styles.aiSection}><Text style={styles.infoTitle}>{label}</Text><Text style={styles.aiBody}>{text}</Text></View>; }
function AiList({ label, values, warning = false }: { label: string; values: string[]; warning?: boolean }) { return <View style={[styles.aiSection, warning && styles.warningSection]}><Text style={styles.infoTitle}>{label}</Text>{values.map((value, index) => <Text key={`${index}-${value}`} style={styles.aiBullet}>• {value}</Text>)}</View>; }
function QualityMetric({ label, value }: { label: string; value: string }) { return <View style={styles.qualityMetric}><Text style={styles.qualityLabel}>{label}</Text><Text numberOfLines={1} style={styles.qualityValue}>{value}</Text></View>; }
function ExampleReport({ examples }: { examples: PatentExample[] }) {
  const compositionRows = examples.flatMap((example) => (example.composition ?? []).map((row) => [example.example_number, row.component, [row.amount, row.unit].filter(Boolean).join(' ') || '—', row.basis || '—', row.role || '—', pageLabel(row.page)]));
  const productionRows = examples.flatMap((example) => (example.production_steps ?? []).map((row) => [example.example_number, row.step_number, row.instruction, row.conditions.join(' · ') || '—', pageLabel(row.page)]));
  const testRows = examples.flatMap((example) => (example.test_results ?? []).map((row) => [example.example_number, [row.test_name, row.method].filter(Boolean).join(' · '), `${row.result}${row.unit ? ` ${row.unit}` : ''}`, row.specimen || '—', pageLabel(row.page)]));
  return <View style={styles.exampleReport}>
    <View style={styles.performanceHeading}><View><Text style={styles.infoTitle}>YAPILANDIRILMIŞ DENEY RAPORU</Text><Text style={styles.performanceTitle}>Örnek ve sonuç tabloları</Text></View><Text style={styles.performanceCount}>{examples.length} örnek</Text></View>
    <MobileDataTable title="Örnek özeti" headers={['Örnek', 'Türkçe özet', 'Koşullar', 'Sonuç', 'Sayfa']} rows={examples.map((example) => [example.example_number, example.summary, example.conditions?.join(' · ') || '—', example.outcome || '—', pageLabel(example.page)])} widths={[80, 230, 150, 180, 70]} />
    {compositionRows.length ? <MobileDataTable title="İçerik / formülasyon" headers={['Örnek', 'Bileşen', 'Miktar', 'Baz', 'Rol', 'Sayfa']} rows={compositionRows} widths={[80, 145, 90, 130, 120, 70]} /> : null}
    {productionRows.length ? <MobileDataTable title="Üretim aşamaları" headers={['Örnek', 'Adım', 'Türkçe talimat', 'Koşullar', 'Sayfa']} rows={productionRows} widths={[80, 55, 245, 150, 70]} /> : null}
    {testRows.length ? <MobileDataTable title="Test sonuçları" headers={['Örnek', 'Test / metot', 'Sonuç', 'Numune', 'Sayfa']} rows={testRows} widths={[80, 190, 110, 135, 70]} /> : null}
    {!compositionRows.length && !productionRows.length && !testRows.length ? <Text style={styles.performanceEmpty}>Bu eski analizi ayrıntılı tablolarla yenilemek için PDF’yi yeniden tarayın.</Text> : null}
  </View>;
}
function MobileDataTable({ title, headers, rows, widths }: { title: string; headers: string[]; rows: string[][]; widths: number[] }) {
  return <View style={styles.tableBlock}><View style={styles.tableTitleRow}><Text style={styles.tableTitle}>{title}</Text><Text style={styles.tableCount}>{rows.length} satır</Text></View><ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator><View style={styles.dataTable}><View style={[styles.tableRow, styles.tableHeader]}>{headers.map((header, index) => <Text key={header} style={[styles.tableHeaderCell, { width: widths[index] }]}>{header}</Text>)}</View>{rows.map((row, rowIndex) => <View key={`${title}-${rowIndex}`} style={styles.tableRow}>{row.map((cell, cellIndex) => <Text key={`${rowIndex}-${cellIndex}`} style={[styles.tableCell, { width: widths[cellIndex] }]}>{cell}</Text>)}</View>)}</View></ScrollView></View>;
}
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
function providerLabel(model?: string | null) { if (!model) return '—'; if (model.startsWith('gemini:')) return model.slice(7); if (model.startsWith('openai:')) return model.slice(7); return model; }
function estimatedPaidCostTry(run: AnalysisRun) { const input = run.input_tokens ?? 0; const output = run.output_tokens ?? 0; if (!input && !output) return '—'; const model = run.model ?? ''; const prices = model.includes('gemini-3.7-flash') ? [.75, 3.75] : model.includes('gemini-3.5-flash-lite') ? [.30, 2.50] : model.includes('gpt-5.6') ? [4, 20] : null; if (!prices) return '—'; return `≈ ₺${(((input * prices[0] + output * prices[1]) / 1_000_000) * 48.16).toFixed(2)}`; }
function suggestionType(type: string) { return ({ CHEMICAL: 'KİMYASAL', COMMERCIAL_PRODUCT: 'TİCARİ ÜRÜN', APPLICATION_CATEGORY: 'UYGULAMA', TECHNICAL_PURPOSE: 'TEKNİK AMAÇ' } as Record<string, string>)[type] ?? type; }
function confidenceLabel(value: number) { return value >= .85 ? 'Yüksek' : value >= .7 ? 'Orta' : 'Kontrol'; }
function pageLabel(page: number | null) { return page ? `PDF s. ${page}` : '—'; }

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }, content: { gap: 16, padding: 18, paddingBottom: 50, backgroundColor: palette.background },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 }, badge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, fontSize: 10, fontWeight: '800' }, number: { flex: 1, color: palette.textMuted, fontSize: 11, letterSpacing: .5, fontWeight: '700' }, favorite: { color: palette.amber, fontSize: 27 },
  heroTitle: { color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: '700' }, meta: { marginTop: -8, color: palette.textMuted, fontSize: 12 },
  pdfButton: { padding: 17, borderWidth: 1, borderColor: palette.blue, borderRadius: 18, backgroundColor: palette.blueMuted }, pdfTitle: { color: '#D9E2FF', fontSize: 14, fontWeight: '800' }, pdfMeta: { marginTop: 5, color: '#9FB2E8', fontSize: 10 },
  aiCard: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 21, backgroundColor: '#11151C' }, aiHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, aiHeaderCopy: { flex: 1, gap: 5 }, aiEyebrow: { color: '#8498CC', fontSize: 8, letterSpacing: 1.1, fontWeight: '800' }, aiStatus: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, overflow: 'hidden', color: '#B9C8F7', backgroundColor: palette.blueMuted, fontSize: 7, fontWeight: '800' }, aiDescription: { color: palette.textMuted, fontSize: 10, lineHeight: 16 }, providerLine: { gap: 3, padding: 11, borderWidth: 1, borderColor: '#33405A', borderRadius: 12, backgroundColor: '#111A29' }, providerTitle: { color: '#D9E2FF', fontSize: 11, fontWeight: '800' }, providerMeta: { color: '#8FA4DE', fontSize: 8 }, disabled: { opacity: .42 }, aiError: { padding: 11, borderRadius: 11, overflow: 'hidden', color: palette.danger, backgroundColor: palette.dangerMuted, fontSize: 10, lineHeight: 15 }, aiReport: { gap: 8 }, qualityRow: { flexDirection: 'row', gap: 7 }, qualityMetric: { minWidth: 0, flex: 1, gap: 5, padding: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 12, backgroundColor: '#0D131C' }, qualityLabel: { color: '#7484AD', fontSize: 6, letterSpacing: .6, fontWeight: '800' }, qualityValue: { color: '#DCE2ED', fontSize: 11, fontWeight: '800' }, aiSection: { gap: 7, padding: 13, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.surfaceMuted }, warningSection: { borderColor: '#554631', backgroundColor: '#211C15' }, aiBody: { color: '#C3C9D3', fontSize: 10, lineHeight: 16 }, aiBullet: { color: '#C3C9D3', fontSize: 10, lineHeight: 16 }, suggestionList: { gap: 9, paddingTop: 4 }, suggestion: { gap: 8, padding: 13, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 14, backgroundColor: palette.surfaceMuted }, reviewedSuggestion: { opacity: .62 }, suggestionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, suggestionType: { color: '#9DAFDF', fontSize: 7, letterSpacing: .6, fontWeight: '800' }, confidence: { color: palette.textMuted, fontSize: 8 }, suggestionLabel: { color: palette.text, fontSize: 12, fontWeight: '800' }, evidence: { padding: 10, borderLeftWidth: 2, borderLeftColor: '#5875BD', color: '#B9C0CC', backgroundColor: '#151C2B', fontSize: 9, lineHeight: 14 }, reviewButtons: { flexDirection: 'row', gap: 7 }, reviewButton: { minHeight: 36, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.blueMuted }, reviewButtonText: { color: '#CAD4F3', fontSize: 9, fontWeight: '800' }, rejectButton: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 10 }, rejectText: { color: '#A9B0BC', fontSize: 9, fontWeight: '700' }, reviewedText: { color: '#A9B9E8', fontSize: 9, fontWeight: '700' }, catalogWarning: { color: '#C9A777', fontSize: 8, lineHeight: 12 }, aiDisclaimer: { color: '#737C89', fontSize: 8, lineHeight: 13 }, correctionBox: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#3B4659', borderRadius: 12, backgroundColor: '#121925' }, correctionTitle: { color: '#E7EBF3', fontSize: 11, fontWeight: '800' }, correctionInput: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3A465A', borderRadius: 10, color: palette.text, backgroundColor: '#0C1118', fontSize: 11 }, correctionHelp: { color: '#909AAE', fontSize: 8, lineHeight: 12 }, correctionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, correctionPrimary: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#1D2A47' }, correctionPrimaryText: { color: '#D9E3FF', fontSize: 8, fontWeight: '800' }, correctionSecondary: { minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 9 }, correctionSecondaryText: { color: '#AFB7C5', fontSize: 8, fontWeight: '700' },
  performanceCard: { gap: 13, padding: 14, borderWidth: 1, borderColor: '#303A4A', borderRadius: 15, backgroundColor: '#0D131C' }, performanceHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, performanceTitle: { marginTop: 5, color: palette.text, fontSize: 16, fontWeight: '700' }, performanceCount: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, overflow: 'hidden', color: '#B9C8F7', backgroundColor: palette.blueMuted, fontSize: 7, fontWeight: '800' }, performanceRow: { gap: 6 }, performanceLabel: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, performanceName: { flex: 1, color: '#C7CEDA', fontSize: 9, fontWeight: '700' }, performanceValue: { color: '#B9C9FF', fontSize: 9, fontWeight: '800' }, performanceTrack: { height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#202733' }, performanceBar: { height: '100%', borderRadius: 99, backgroundColor: '#5F82E5' }, performanceContext: { color: '#747E8D', fontSize: 7, lineHeight: 11 }, performanceEmpty: { color: palette.textMuted, fontSize: 9 },
  exampleReport: { gap: 14, padding: 14, borderWidth: 1, borderColor: '#303A4A', borderRadius: 15, backgroundColor: '#0D131C' }, tableBlock: { gap: 7 }, tableTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, tableTitle: { color: '#DCE2EC', fontSize: 10, fontWeight: '800' }, tableCount: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99, overflow: 'hidden', color: '#AEBEED', backgroundColor: '#1B2742', fontSize: 7, fontWeight: '700' }, dataTable: { overflow: 'hidden', borderWidth: 1, borderColor: '#29313D', borderRadius: 11, backgroundColor: '#0C1117' }, tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#232A34' }, tableHeader: { backgroundColor: '#111824' }, tableHeaderCell: { paddingHorizontal: 9, paddingVertical: 9, color: '#8293BE', fontSize: 7, letterSpacing: .5, fontWeight: '800', textTransform: 'uppercase' }, tableCell: { paddingHorizontal: 9, paddingVertical: 10, color: '#BBC2CD', fontSize: 9, lineHeight: 14 },
  card: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface }, cardTitle: { marginBottom: 2, color: palette.text, fontSize: 19, fontWeight: '700' }, field: { gap: 7 }, label: { color: '#B7BDC8', fontSize: 11, fontWeight: '700' }, input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted }, textarea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  saveButton: { height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 3, borderRadius: 15, backgroundColor: palette.blue }, saveText: { color: '#F7F9FF', fontSize: 13, fontWeight: '800' },
  info: { gap: 9, paddingTop: 15, borderTopWidth: 1, borderTopColor: palette.border }, infoTitle: { color: palette.textMuted, fontSize: 9, letterSpacing: 1, fontWeight: '800' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, overflow: 'hidden', color: '#C8D5FF', backgroundColor: palette.blueMuted, fontSize: 10, fontWeight: '700' }, material: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, backgroundColor: palette.blueMuted }, tagText: { color: '#C8D5FF', fontSize: 10, fontWeight: '800' }, role: { marginTop: 2, color: '#8FA4DE', fontSize: 8 }, empty: { color: palette.textMuted, fontSize: 11 },
  deleteButton: { height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#5A3430', borderRadius: 15, backgroundColor: palette.dangerMuted }, deleteText: { color: palette.danger, fontSize: 12, fontWeight: '800' },
});
