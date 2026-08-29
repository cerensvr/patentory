import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/palette';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Named = { id: string; name: string };
type Chemical = { id: string; canonical_name: string; abbreviation: string | null; cas_number: string | null; chemical_class: string | null };
type CommercialProduct = { id: string; trade_name: string; manufacturer: string | null; product_type: string | null };
type LookupChemical = { chemical_id: string; role_id: string | null; confidence: number; evidence: string };
type LookupProduct = { commercial_product_id: string; role_id: string | null; confidence: number; evidence: string };
type LookupSuggestions = { category_ids: string[]; purpose_ids: string[]; chemicals: LookupChemical[]; commercial_products?: LookupProduct[] };

export default function NewPatentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [pdf, setPdf] = useState<DocumentPicker.DocumentPickerAsset>();
  const [title, setTitle] = useState('');
  const [patentNumber, setPatentNumber] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [summary, setSummary] = useState('');
  const [abstractText, setAbstractText] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState<Named[]>([]);
  const [purposes, setPurposes] = useState<Named[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [commercialProducts, setCommercialProducts] = useState<CommercialProduct[]>([]);
  const [roles, setRoles] = useState<Named[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [purposeIds, setPurposeIds] = useState<string[]>([]);
  const [chemicalIds, setChemicalIds] = useState<string[]>([]);
  const [chemicalQuery, setChemicalQuery] = useState('');
  const [roleByChemical, setRoleByChemical] = useState<Record<string, string>>({});
  const [productIds, setProductIds] = useState<string[]>([]);
  const [roleByProduct, setRoleByProduct] = useState<Record<string, string>>({});
  const [suggestedCategoryIds, setSuggestedCategoryIds] = useState<string[]>([]);
  const [suggestedPurposeIds, setSuggestedPurposeIds] = useState<string[]>([]);
  const [suggestedChemicalIds, setSuggestedChemicalIds] = useState<string[]>([]);
  const [suggestedProductIds, setSuggestedProductIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string>();

  useEffect(() => {
    Promise.all([
      supabase.from('application_categories').select('id,name').order('name'),
      supabase.from('technical_purposes').select('id,name').order('name'),
      supabase.from('chemicals').select('id,canonical_name,abbreviation,cas_number,chemical_class').order('canonical_name'),
      supabase.from('commercial_products').select('id,trade_name,manufacturer,product_type').order('trade_name'),
      supabase.from('chemical_roles').select('id,name').order('name'),
    ]).then(([categoryResult, purposeResult, chemicalResult, productResult, roleResult]) => {
      setCategories(categoryResult.data ?? []);
      setPurposes(purposeResult.data ?? []);
      setChemicals(chemicalResult.data ?? []);
      setCommercialProducts(productResult.data ?? []);
      setRoles(roleResult.data ?? []);
    });
  }, []);
  const visibleChemicals = chemicals.filter((chemical) => `${chemical.abbreviation ?? ''} ${chemical.canonical_name} ${chemical.cas_number ?? ''} ${chemical.chemical_class ?? ''}`.toLocaleLowerCase('tr').includes(chemicalQuery.trim().toLocaleLowerCase('tr')));

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 50 * 1024 * 1024) Alert.alert('Dosya çok büyük', 'PDF en fazla 50 MB olabilir.');
      else {
        setPdf(asset);
        const inferred = inferPatentNumber(asset.name);
        if (!inferred) { setLookupMessage('Patent numarası dosya adından okunamadı; alanları manuel doldurun.'); return; }
        setPatentNumber((current) => current || inferred.number);
        setCountryCode((current) => current || inferred.country);
        setLookupBusy(true); setLookupMessage(`${inferred.number} için yayın bilgileri aranıyor…`);
        const { data, error } = await supabase.functions.invoke('lookup-patent-metadata', { body: { patentNumber: inferred.number } });
        setLookupBusy(false);
        if (error || data?.error || !data?.metadata) { setLookupMessage('Numara ve ülke dolduruldu; diğer alanları manuel tamamlayabilirsiniz.'); return; }
        const metadata = data.metadata as PatentMetadata;
        setTitle((current) => current || metadata.title || '');
        setPatentNumber((current) => normalizeNumber(current) === normalizeNumber(inferred.number) ? metadata.patent_number || current : current);
        setCountryCode((current) => current || metadata.country_code || '');
        setPublicationDate((current) => current || metadata.publication_date || '');
        setAssignee((current) => current || metadata.assignee || '');
        setAbstractText((current) => current || metadata.abstract || '');
        const suggestions = data.suggestions as LookupSuggestions | undefined;
        if (suggestions) {
          const suggestedChemicals = suggestions.chemicals.map((item) => item.chemical_id);
          const suggestedRoles = Object.fromEntries(suggestions.chemicals.filter((item) => item.role_id).map((item) => [item.chemical_id, item.role_id as string]));
          const productSuggestions = suggestions.commercial_products ?? [];
          const suggestedProducts = productSuggestions.map((item) => item.commercial_product_id);
          const suggestedProductRoles = Object.fromEntries(productSuggestions.filter((item) => item.role_id).map((item) => [item.commercial_product_id, item.role_id as string]));
          setSuggestedCategoryIds(suggestions.category_ids);
          setSuggestedPurposeIds(suggestions.purpose_ids);
          setSuggestedChemicalIds(suggestedChemicals);
          setSuggestedProductIds(suggestedProducts);
          setCategoryIds((current) => current.length ? current : suggestions.category_ids);
          setPurposeIds((current) => current.length ? current : suggestions.purpose_ids);
          setChemicalIds((current) => current.length ? current : suggestedChemicals);
          setRoleByChemical((current) => Object.keys(current).length ? current : suggestedRoles);
          setProductIds((current) => current.length ? current : suggestedProducts);
          setRoleByProduct((current) => Object.keys(current).length ? current : suggestedProductRoles);
          const counts = [suggestions.category_ids.length ? `${suggestions.category_ids.length} kategori` : '', suggestions.purpose_ids.length ? `${suggestions.purpose_ids.length} teknik amaç` : '', suggestedChemicals.length ? `${suggestedChemicals.length} kimyasal` : '', suggestedProducts.length ? `${suggestedProducts.length} ticari ürün` : ''].filter(Boolean).join(', ');
          setLookupMessage(counts ? `Yayın bilgileri dolduruldu; ${counts} kanıta göre önerildi. Kontrol edebilirsiniz.` : 'Yayın bilgileri dolduruldu. Sınıflandırma için yeterli açık kanıt yok; manuel seçebilirsiniz.');
        } else setLookupMessage('Yayın bilgileri otomatik dolduruldu; sınıflandırmayı manuel kontrol edin.');
      }
    }
  };

  const save = async () => {
    if (!session || !pdf || !title.trim()) { Alert.alert('Eksik bilgi', 'Başlık ve PDF zorunludur.'); return; }
    if (chemicalIds.some((chemicalId) => !roleByChemical[chemicalId])) { Alert.alert('Kimyasal rolü gerekli', 'Seçtiğiniz her kimyasalın patentteki rolünü ayrı seçin.'); return; }
    if (productIds.some((productId) => !roleByProduct[productId])) { Alert.alert('Ürün rolü gerekli', 'Seçtiğiniz her ticari ürünün patentteki rolünü ayrı seçin.'); return; }
    setSaving(true);
    const patentId = Crypto.randomUUID();
    const storagePath = `${session.user.id}/${patentId}/${Crypto.randomUUID()}.pdf`;
    const { error: insertError } = await supabase.from('patents').insert({
      id: patentId, owner_user_id: session.user.id, title: title.trim(),
      patent_number: patentNumber.trim() || null, country_code: countryCode.trim().toUpperCase() || null,
      publication_date: publicationDate || null, assignee: assignee.trim() || null,
      abstract_text: abstractText.trim() || null, user_summary: summary.trim() || null, notes: notes.trim() || null,
    });
    if (insertError) { setSaving(false); Alert.alert('Patent kaydedilemedi', insertError.message); return; }

    try {
      const bytes = await (await fetch(pdf.uri)).arrayBuffer();
      const { error: uploadError } = await supabase.storage.from('patent-pdfs').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { error: metadataError } = await supabase.from('patents').update({
        pdf_storage_path: storagePath, pdf_original_filename: pdf.name.slice(0, 255),
        pdf_size_bytes: pdf.size ?? bytes.byteLength, pdf_mime_type: 'application/pdf',
      }).eq('id', patentId).eq('owner_user_id', session.user.id);
      if (metadataError) throw metadataError;

      await Promise.all([
        categoryIds.length ? supabase.from('patent_application_categories').insert(categoryIds.map((category_id) => ({ patent_id: patentId, category_id }))) : null,
        purposeIds.length ? supabase.from('patent_technical_purposes').insert(purposeIds.map((purpose_id) => ({ patent_id: patentId, purpose_id }))) : null,
        chemicalIds.length ? supabase.from('patent_chemicals').insert(chemicalIds.map((chemical_id) => ({ patent_id: patentId, chemical_id, chemical_role_id: roleByChemical[chemical_id], source_type: 'MANUAL', user_confirmed: true }))) : null,
        productIds.length ? supabase.from('patent_chemicals').insert(productIds.map((commercial_product_id) => ({ patent_id: patentId, commercial_product_id, chemical_role_id: roleByProduct[commercial_product_id], source_type: 'MANUAL', user_confirmed: true }))) : null,
      ]);

      for (const name of tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)) {
        let { data: tag } = await supabase.from('tags').select('id').eq('owner_user_id', session.user.id).ilike('name', name).maybeSingle();
        if (!tag) tag = (await supabase.from('tags').insert({ owner_user_id: session.user.id, name }).select('id').single()).data;
        if (tag) await supabase.from('patent_tags').insert({ patent_id: patentId, tag_id: tag.id });
      }
      router.replace(`/patents/${patentId}`);
    } catch (error) {
      await supabase.storage.from('patent-pdfs').remove([storagePath]);
      await supabase.from('patents').delete().eq('id', patentId);
      Alert.alert('Yükleme başarısız', error instanceof Error ? error.message : 'PDF yüklenemedi.');
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Patent ekle' }} />
      <Text style={styles.eyebrow}>KONTROLLÜ İŞ AKIŞI</Text><Text style={styles.title}>Yeni patent</Text><Text style={styles.copy}>PDF’den yayın bilgilerini otomatik getirin; kaydetmeden önce düzenleyin.</Text>
      <Section title="01 · PDF ve bilgiler">
        <Pressable onPress={pickPdf} style={[styles.fileButton, pdf && styles.fileSelected]}><Text style={styles.fileTitle}>{pdf ? pdf.name : 'PDF dosyası seçin'}</Text><Text style={styles.fileMeta}>{pdf ? `${((pdf.size ?? 0) / 1024 / 1024).toFixed(1)} MB` : 'Özel depolama · En fazla 50 MB'}</Text></Pressable>
        {lookupMessage && <Text style={styles.lookupMessage}>{lookupBusy ? '⌛ ' : '✓ '}{lookupMessage}</Text>}
        <Field label="Başlık" value={title} onChangeText={setTitle} />
        <Field label="Patent numarası" value={patentNumber} onChangeText={setPatentNumber} placeholder="EP 3 821 947 A1" />
        <View style={styles.twoColumns}><Field compact label="Ülke kodu" value={countryCode} onChangeText={setCountryCode} placeholder="EP" /><Field compact label="Hak sahibi" value={assignee} onChangeText={setAssignee} /></View>
        <Field label="Yayın tarihi (YYYY-AA-GG)" value={publicationDate} onChangeText={setPublicationDate} placeholder="2024-03-18" />
        <Field label="Türkçe abstract / özet" value={summary} onChangeText={setSummary} multiline placeholder="PDF taramasının Türkçe özeti burada görünür; dilediğiniz gibi düzenleyebilirsiniz." />
        <Field label="Orijinal abstract" value={abstractText} onChangeText={setAbstractText} multiline />
        <Field label="Notlar" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <Section title="02 · Uygulama">{suggestedCategoryIds.length > 0 && <Text style={styles.suggestionBadge}>OTOMATİK ÖNERİ · KONTROL EDİN</Text>}<ChoiceGrid items={categories} selected={categoryIds} setSelected={setCategoryIds} /></Section>
      <Section title="03 · Teknik amaç">{suggestedPurposeIds.length > 0 && <Text style={styles.suggestionBadge}>OTOMATİK ÖNERİ · KONTROL EDİN</Text>}<ChoiceGrid items={purposes} selected={purposeIds} setSelected={setPurposeIds} /></Section>
      <Section title="04 · Kimyasallar ve rol">
        {suggestedChemicalIds.length > 0 && <Text style={styles.suggestionBadge}>BELGEDEN EŞLEŞTİ · KONTROL EDİN</Text>}
        <Text style={styles.helper}>Her kimyasalın rolü ayrı belirlenir; isim, kısaltma, CAS veya sınıfla arayabilirsiniz.</Text>
        <Field label="Katalogda ara" value={chemicalQuery} onChangeText={setChemicalQuery} placeholder="DICY, anhidrit, amin, 461-58-5…" />
        <Text style={styles.label}>Kimyasallar · {visibleChemicals.length}</Text><ChoiceGrid items={visibleChemicals.map((item) => ({ id: item.id, name: `${item.abbreviation || item.canonical_name}${suggestedChemicalIds.includes(item.id) ? ' · önerildi' : ''}` }))} selected={chemicalIds} setSelected={(ids) => { setChemicalIds(ids); setRoleByChemical((current) => Object.fromEntries(Object.entries(current).filter(([chemicalId]) => ids.includes(chemicalId)))); }} />
        {chemicalIds.map((chemicalId) => { const chemical = chemicals.find((item) => item.id === chemicalId); return <View key={chemicalId} style={styles.roleCard}><Text style={styles.roleTitle}>{chemical?.abbreviation || chemical?.canonical_name || 'Kimyasal'} rolü</Text><ChoiceGrid items={roles} selected={roleByChemical[chemicalId] ? [roleByChemical[chemicalId]] : []} setSelected={(ids) => setRoleByChemical((current) => ({ ...current, [chemicalId]: ids.at(-1) ?? '' }))} single /></View>; })}
      </Section>
      <Section title="05 · Ticari ürünler ve rol">
        {suggestedProductIds.length > 0 && <Text style={styles.suggestionBadge}>TİCARİ AD EŞLEŞTİ · KONTROL EDİN</Text>}
        <Text style={styles.helper}>Ticari ürün saf kimyasal sayılmaz; türü ve bileşen bağlantıları ayrı tutulur.</Text>
        <ChoiceGrid items={commercialProducts.map((item) => ({ id: item.id, name: `${item.trade_name}${suggestedProductIds.includes(item.id) ? ' · önerildi' : ''}` }))} selected={productIds} setSelected={(ids) => { setProductIds(ids); setRoleByProduct((current) => Object.fromEntries(Object.entries(current).filter(([productId]) => ids.includes(productId)))); }} />
        {productIds.map((productId) => { const product = commercialProducts.find((item) => item.id === productId); return <View key={productId} style={styles.roleCard}><Text style={styles.roleTitle}>{product?.trade_name || 'Ticari ürün'} rolü</Text><Text style={styles.productMeta}>{productTypeLabel(product?.product_type ?? null)} · {product?.manufacturer || 'Üretici belirsiz'}</Text><ChoiceGrid items={roles} selected={roleByProduct[productId] ? [roleByProduct[productId]] : []} setSelected={(ids) => setRoleByProduct((current) => ({ ...current, [productId]: ids.at(-1) ?? '' }))} single /></View>; })}
      </Section>
      <Section title="06 · Özel etiketler"><Field label="Virgülle ayırın" value={tags} onChangeText={setTags} placeholder="rakip, yüksek Tg, incelenecek" /></Section>
      <Pressable disabled={saving || lookupBusy} onPress={save} style={[styles.saveButton, lookupBusy && { opacity: .5 }]}>{saving || lookupBusy ? <ActivityIndicator color="#F7F9FF" /> : <Text style={styles.saveText}>PDF’yi yükle ve kaydet</Text>}</Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & React.ComponentProps<typeof TextInput>) { return <View style={[styles.field, compact && { flex: 1 }]}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={palette.textMuted} style={[styles.input, multiline && styles.textarea]} multiline={multiline} {...props} /></View>; }
function ChoiceGrid({ items, selected, setSelected, single = false }: { items: Named[]; selected: string[]; setSelected: (ids: string[]) => void; single?: boolean }) {
  return <View style={styles.choiceGrid}>{items.map((item) => { const active = selected.includes(item.id); return <Pressable key={item.id} onPress={() => setSelected(single ? [item.id] : active ? selected.filter((id) => id !== item.id) : [...selected, item.id])} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{active ? '✓ ' : ''}{item.name}</Text></Pressable>; })}</View>;
}

type PatentMetadata = { title: string | null; patent_number: string | null; country_code: string | null; publication_date: string | null; assignee: string | null; abstract: string | null };
function normalizeNumber(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function inferPatentNumber(filename: string) { const match = normalizeNumber(filename.replace(/\.pdf$/i, '')).match(/([A-Z]{2})(\d{4,})([A-Z]\d?)?/); return match ? { country: match[1], number: `${match[1]}${match[2]}${match[3] ?? ''}` } : null; }
function productTypeLabel(value: string | null) { if (value === 'PURE_SUBSTANCE' || value === 'PURE_CHEMICAL') return 'Saf madde olarak kayıtlı'; if (value === 'MIXTURE') return 'Karışım'; if (value === 'FORMULATED_PRODUCT') return 'Formüle ürün'; return 'Türü doğrulanmalı'; }

const styles = StyleSheet.create({
  content: { gap: 16, padding: 18, paddingBottom: 50, backgroundColor: palette.background },
  eyebrow: { marginTop: 8, color: palette.amber, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
  title: { color: palette.text, fontSize: 36, lineHeight: 42, fontWeight: '700' }, copy: { marginTop: -10, marginBottom: 6, color: palette.textMuted, fontSize: 13 },
  section: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface },
  sectionTitle: { marginBottom: 3, color: palette.text, fontSize: 18, fontWeight: '700' },
  fileButton: { minHeight: 88, justifyContent: 'center', padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.borderStrong, borderRadius: 16, backgroundColor: palette.surfaceMuted },
  fileSelected: { borderStyle: 'solid', borderColor: palette.blue, backgroundColor: palette.blueMuted }, fileTitle: { color: palette.text, fontSize: 14, fontWeight: '700' }, fileMeta: { marginTop: 5, color: palette.textMuted, fontSize: 11 },
  lookupMessage: { padding: 11, borderRadius: 12, overflow: 'hidden', color: '#BAC8F3', backgroundColor: palette.blueMuted, fontSize: 10, lineHeight: 15 },
  suggestionBadge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: '#415B9D', borderRadius: 999, overflow: 'hidden', color: '#BDCBF5', backgroundColor: '#1A2540', fontSize: 8, fontWeight: '800', letterSpacing: .6 },
  helper: { marginTop: -4, color: palette.textMuted, fontSize: 10, lineHeight: 15 },
  roleCard: { gap: 10, marginTop: 4, padding: 13, borderWidth: 1, borderColor: palette.border, borderRadius: 15, backgroundColor: palette.surfaceMuted }, roleTitle: { color: palette.text, fontSize: 12, fontWeight: '800' },
  productMeta: { marginTop: -5, color: palette.textMuted, fontSize: 9 },
  field: { gap: 7 }, label: { color: '#B7BDC8', fontSize: 11, fontWeight: '700' }, input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted }, textarea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }, twoColumns: { flexDirection: 'row', gap: 10 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 13, backgroundColor: palette.surfaceMuted }, choiceActive: { borderColor: palette.blue, backgroundColor: palette.blueMuted }, choiceText: { color: palette.textMuted, fontSize: 11, fontWeight: '600' }, choiceTextActive: { color: '#C8D5FF' },
  saveButton: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.blue }, saveText: { color: '#F7F9FF', fontSize: 14, fontWeight: '800' },
});
