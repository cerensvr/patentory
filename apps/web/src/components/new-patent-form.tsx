'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

type Named = { id: string; name: string };
type Chemical = { id: string; canonical_name: string; abbreviation: string | null; cas_number: string | null };

export function NewPatentForm({ categories, chemicals, purposes, roles, userId }: {
  categories: Named[];
  chemicals: Chemical[];
  purposes: Named[];
  roles: Named[];
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const pdf = form.get('pdf') as File;

    if (!pdf || pdf.type !== 'application/pdf' || !pdf.name.toLowerCase().endsWith('.pdf')) {
      setError('Lütfen geçerli bir PDF seçin.'); setBusy(false); return;
    }
    if (pdf.size > 50 * 1024 * 1024) {
      setError('PDF en fazla 50 MB olabilir.'); setBusy(false); return;
    }
    const chemicalIds = form.getAll('chemical_ids').map(String);
    const roleId = String(form.get('chemical_role_id') ?? '');
    if (chemicalIds.length && !roleId) {
      setError('Seçtiğiniz kimyasalların patentteki rolünü de seçin.'); setBusy(false); return;
    }

    const supabase = createClient();
    const patentId = crypto.randomUUID();
    const storagePath = `${userId}/${patentId}/${crypto.randomUUID()}.pdf`;
    const text = (name: string) => String(form.get(name) ?? '').trim() || null;
    const { error: patentError } = await supabase.from('patents').insert({
      id: patentId,
      owner_user_id: userId,
      title: text('title'),
      patent_number: text('patent_number'),
      country_code: text('country_code')?.toUpperCase() ?? null,
      publication_date: text('publication_date'),
      assignee: text('assignee'),
      abstract_text: text('abstract_text'),
      notes: text('notes'),
      user_summary: text('user_summary'),
    });

    if (patentError) { setError(patentError.message); setBusy(false); return; }

    const { error: uploadError } = await supabase.storage.from('patent-pdfs').upload(storagePath, pdf, {
      contentType: 'application/pdf', cacheControl: '3600', upsert: false,
    });
    if (uploadError) {
      await supabase.from('patents').delete().eq('id', patentId);
      setError(uploadError.message); setBusy(false); return;
    }

    const { error: metadataError } = await supabase.from('patents').update({
      pdf_storage_path: storagePath,
      pdf_original_filename: pdf.name.slice(0, 255),
      pdf_size_bytes: pdf.size,
      pdf_mime_type: 'application/pdf',
    }).eq('id', patentId).eq('owner_user_id', userId);

    const categoryIds = form.getAll('category_ids').map(String);
    const purposeIds = form.getAll('purpose_ids').map(String);

    const linkResults = await Promise.all([
      categoryIds.length ? supabase.from('patent_application_categories').insert(categoryIds.map((category_id) => ({ patent_id: patentId, category_id }))) : Promise.resolve({ error: null }),
      purposeIds.length ? supabase.from('patent_technical_purposes').insert(purposeIds.map((purpose_id) => ({ patent_id: patentId, purpose_id }))) : Promise.resolve({ error: null }),
      chemicalIds.length && roleId ? supabase.from('patent_chemicals').insert(chemicalIds.map((chemical_id) => ({ patent_id: patentId, chemical_id, chemical_role_id: roleId, source_type: 'MANUAL', user_confirmed: true }))) : Promise.resolve({ error: null }),
    ]);

    const tagNames = String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    for (const name of tagNames) {
      let { data: tag } = await supabase.from('tags').select('id').eq('owner_user_id', userId).ilike('name', name).maybeSingle();
      if (!tag) {
        const inserted = await supabase.from('tags').insert({ owner_user_id: userId, name }).select('id').single();
        tag = inserted.data;
      }
      if (tag) await supabase.from('patent_tags').insert({ patent_id: patentId, tag_id: tag.id });
    }

    const linkError = linkResults.find((result) => result.error)?.error;
    if (metadataError || linkError) {
      setError((metadataError ?? linkError)?.message ?? 'Sınıflandırma kaydedilemedi.');
      setBusy(false); return;
    }

    router.replace(`/patents/${patentId}`);
    router.refresh();
  }

  return (
    <div className="form-page">
      <div className="form-heading"><Link href="/">← Kütüphaneye dön</Link><p className="eyebrow">MANUEL İŞ AKIŞI</p><h1>Yeni patent ekle</h1><p>PDF yükleyin, temel bilgileri ve sınıflandırmayı manuel olarak kaydedin.</p></div>
      <form className="patent-form" onSubmit={submit}>
        {error && <p className="form-message error">{error}</p>}
        <section><h2>01 · PDF ve temel bilgiler</h2><div className="field-grid">
          <label className="full">Patent PDF <input name="pdf" type="file" accept="application/pdf,.pdf" required /><small>Özel bucket’ta saklanır · En fazla 50 MB</small></label>
          <label className="full">Başlık <input name="title" required maxLength={500} /></label>
          <label>Patent numarası <input name="patent_number" placeholder="EP 3 821 947 A1" /></label>
          <label>Ülke kodu <input name="country_code" placeholder="EP" maxLength={8} /></label>
          <label>Yayın tarihi <input name="publication_date" type="date" /></label>
          <label>Hak sahibi / firma <input name="assignee" /></label>
          <label className="full">Kısa özet <textarea name="user_summary" rows={3} /></label>
          <label className="full">Abstract <textarea name="abstract_text" rows={4} /></label>
          <label className="full">Notlar <textarea name="notes" rows={3} /></label>
        </div></section>
        <section><h2>02 · Uygulama ve teknik amaç</h2><div className="choice-grid"><ChoiceGroup name="category_ids" title="Uygulama kategorileri" items={categories} /><ChoiceGroup name="purpose_ids" title="Teknik amaçlar" items={purposes} /></div></section>
        <section><h2>03 · Kimyasallar ve rolleri</h2><label className="role-select">Seçilen kimyasalların rolü<select name="chemical_role_id" defaultValue=""><option value="" disabled>Manuel rol seçin</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><div className="chemical-picker">{chemicals.map((chemical) => <label key={chemical.id}><input type="checkbox" name="chemical_ids" value={chemical.id} /><span><strong>{chemical.abbreviation || chemical.canonical_name}</strong><small>{chemical.canonical_name}{chemical.cas_number ? ` · CAS ${chemical.cas_number}` : ''}</small></span></label>)}</div></section>
        <section><h2>04 · Özel etiketler</h2><label>Virgülle ayırın<input name="tags" placeholder="rakip, yüksek Tg, incelenecek" /></label></section>
        <div className="form-footer"><button disabled={busy} className="primary-action" type="submit">{busy ? 'Kaydediliyor…' : 'PDF’yi yükle ve patenti kaydet'}</button></div>
      </form>
    </div>
  );
}

function ChoiceGroup({ items, name, title }: { items: Named[]; name: string; title: string }) {
  return <fieldset><legend>{title}</legend>{items.map((item) => <label key={item.id}><input type="checkbox" name={name} value={item.id} />{item.name}</label>)}</fieldset>;
}
