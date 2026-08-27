import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { palette } from '@/lib/palette';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Named = { id: string; name: string };
type Chemical = { id: string; canonical_name: string; abbreviation: string | null };

export default function NewPatentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [pdf, setPdf] = useState<DocumentPicker.DocumentPickerAsset>();
  const [title, setTitle] = useState('');
  const [patentNumber, setPatentNumber] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [assignee, setAssignee] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [categories, setCategories] = useState<Named[]>([]);
  const [purposes, setPurposes] = useState<Named[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [roles, setRoles] = useState<Named[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [purposeIds, setPurposeIds] = useState<string[]>([]);
  const [chemicalIds, setChemicalIds] = useState<string[]>([]);
  const [roleId, setRoleId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('application_categories').select('id,name').order('name'),
      supabase.from('technical_purposes').select('id,name').order('name'),
      supabase.from('chemicals').select('id,canonical_name,abbreviation').order('canonical_name'),
      supabase.from('chemical_roles').select('id,name').order('name'),
    ]).then(([categoryResult, purposeResult, chemicalResult, roleResult]) => {
      setCategories(categoryResult.data ?? []);
      setPurposes(purposeResult.data ?? []);
      setChemicals(chemicalResult.data ?? []);
      setRoles(roleResult.data ?? []);
    });
  }, []);

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 50 * 1024 * 1024) Alert.alert('Dosya çok büyük', 'PDF en fazla 50 MB olabilir.');
      else setPdf(asset);
    }
  };

  const save = async () => {
    if (!session || !pdf || !title.trim()) { Alert.alert('Eksik bilgi', 'Başlık ve PDF zorunludur.'); return; }
    if (chemicalIds.length && !roleId) { Alert.alert('Kimyasal rolü gerekli', 'Seçtiğiniz kimyasalların patentteki rolünü de seçin.'); return; }
    setSaving(true);
    const patentId = Crypto.randomUUID();
    const storagePath = `${session.user.id}/${patentId}/${Crypto.randomUUID()}.pdf`;
    const { error: insertError } = await supabase.from('patents').insert({
      id: patentId, owner_user_id: session.user.id, title: title.trim(),
      patent_number: patentNumber.trim() || null, country_code: countryCode.trim().toUpperCase() || null,
      assignee: assignee.trim() || null, user_summary: summary.trim() || null, notes: notes.trim() || null,
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
        chemicalIds.length && roleId ? supabase.from('patent_chemicals').insert(chemicalIds.map((chemical_id) => ({ patent_id: patentId, chemical_id, chemical_role_id: roleId, source_type: 'MANUAL', user_confirmed: true }))) : null,
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
      <Text style={styles.eyebrow}>MANUEL İŞ AKIŞI</Text><Text style={styles.title}>Yeni patent</Text><Text style={styles.copy}>PDF, metadata ve sınıflandırma tek akışta.</Text>
      <Section title="01 · PDF ve bilgiler">
        <Pressable onPress={pickPdf} style={[styles.fileButton, pdf && styles.fileSelected]}><Text style={styles.fileTitle}>{pdf ? pdf.name : 'PDF dosyası seçin'}</Text><Text style={styles.fileMeta}>{pdf ? `${((pdf.size ?? 0) / 1024 / 1024).toFixed(1)} MB` : 'Özel depolama · En fazla 50 MB'}</Text></Pressable>
        <Field label="Başlık" value={title} onChangeText={setTitle} />
        <Field label="Patent numarası" value={patentNumber} onChangeText={setPatentNumber} placeholder="EP 3 821 947 A1" />
        <View style={styles.twoColumns}><Field compact label="Ülke kodu" value={countryCode} onChangeText={setCountryCode} placeholder="EP" /><Field compact label="Hak sahibi" value={assignee} onChangeText={setAssignee} /></View>
        <Field label="Kısa özet" value={summary} onChangeText={setSummary} multiline />
        <Field label="Notlar" value={notes} onChangeText={setNotes} multiline />
      </Section>
      <Section title="02 · Uygulama"><ChoiceGrid items={categories} selected={categoryIds} setSelected={setCategoryIds} /></Section>
      <Section title="03 · Teknik amaç"><ChoiceGrid items={purposes} selected={purposeIds} setSelected={setPurposeIds} /></Section>
      <Section title="04 · Kimyasallar ve rol">
        <Text style={styles.label}>Kimyasal rolü · manuel seçim</Text><ChoiceGrid items={roles} selected={roleId ? [roleId] : []} setSelected={(ids) => setRoleId(ids.at(-1) ?? '')} single />
        <Text style={[styles.label, { marginTop: 18 }]}>Kimyasallar</Text><ChoiceGrid items={chemicals.map((item) => ({ id: item.id, name: item.abbreviation || item.canonical_name }))} selected={chemicalIds} setSelected={setChemicalIds} />
      </Section>
      <Section title="05 · Özel etiketler"><Field label="Virgülle ayırın" value={tags} onChangeText={setTags} placeholder="rakip, yüksek Tg, incelenecek" /></Section>
      <Pressable disabled={saving} onPress={save} style={styles.saveButton}>{saving ? <ActivityIndicator color="#F7F9FF" /> : <Text style={styles.saveText}>PDF’yi yükle ve kaydet</Text>}</Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Field({ label, compact, multiline, ...props }: { label: string; compact?: boolean; multiline?: boolean } & React.ComponentProps<typeof TextInput>) { return <View style={[styles.field, compact && { flex: 1 }]}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={palette.textMuted} style={[styles.input, multiline && styles.textarea]} multiline={multiline} {...props} /></View>; }
function ChoiceGrid({ items, selected, setSelected, single = false }: { items: Named[]; selected: string[]; setSelected: (ids: string[]) => void; single?: boolean }) {
  return <View style={styles.choiceGrid}>{items.map((item) => { const active = selected.includes(item.id); return <Pressable key={item.id} onPress={() => setSelected(single ? [item.id] : active ? selected.filter((id) => id !== item.id) : [...selected, item.id])} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{active ? '✓ ' : ''}{item.name}</Text></Pressable>; })}</View>;
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 18, paddingBottom: 50, backgroundColor: palette.background },
  eyebrow: { marginTop: 8, color: palette.amber, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' },
  title: { color: palette.text, fontSize: 36, lineHeight: 42, fontWeight: '700' }, copy: { marginTop: -10, marginBottom: 6, color: palette.textMuted, fontSize: 13 },
  section: { gap: 14, padding: 18, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface },
  sectionTitle: { marginBottom: 3, color: palette.text, fontSize: 18, fontWeight: '700' },
  fileButton: { minHeight: 88, justifyContent: 'center', padding: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: palette.borderStrong, borderRadius: 16, backgroundColor: palette.surfaceMuted },
  fileSelected: { borderStyle: 'solid', borderColor: palette.blue, backgroundColor: palette.blueMuted }, fileTitle: { color: palette.text, fontSize: 14, fontWeight: '700' }, fileMeta: { marginTop: 5, color: palette.textMuted, fontSize: 11 },
  field: { gap: 7 }, label: { color: '#B7BDC8', fontSize: 11, fontWeight: '700' }, input: { minHeight: 52, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 15, color: palette.text, backgroundColor: palette.surfaceMuted }, textarea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }, twoColumns: { flexDirection: 'row', gap: 10 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 13, backgroundColor: palette.surfaceMuted }, choiceActive: { borderColor: palette.blue, backgroundColor: palette.blueMuted }, choiceText: { color: palette.textMuted, fontSize: 11, fontWeight: '600' }, choiceTextActive: { color: '#C8D5FF' },
  saveButton: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: palette.blue }, saveText: { color: '#F7F9FF', fontSize: 14, fontWeight: '800' },
});
