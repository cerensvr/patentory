'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type ChangeEvent, type FormEvent } from 'react';

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
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [title, setTitle] = useState('');
  const [patentNumber, setPatentNumber] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [abstractText, setAbstractText] = useState('');

  async function selectPdf(event: ChangeEvent<HTMLInputElement>) {
    const pdf = event.target.files?.[0];
    setLookupMessage(undefined);
    if (!pdf) return;
    const inferred = inferPatentNumber(pdf.name);
    if (!inferred) {
      setLookupMessage('Dosya adından patent numarası okunamadı. Alanları manuel doldurabilirsiniz.');
      return;
    }
    setPatentNumber((current) => current || inferred.number);
    setCountryCode((current) => current || inferred.country);
    setLookupBusy(true);
    setLookupMessage(`${inferred.number} için yayın bilgileri aranıyor…`);
    const { data, error: lookupError } = await createClient().functions.invoke('lookup-patent-metadata', {
      body: { patentNumber: inferred.number },
    });
    setLookupBusy(false);
    if (lookupError || data?.error || !data?.metadata) {
      setLookupMessage('Numara ve ülke dosya adından dolduruldu. Diğer alanları manuel tamamlayabilirsiniz.');
      return;
    }
    const metadata = data.metadata as PatentMetadata;
    setTitle((current) => current || metadata.title || '');
    setPatentNumber((current) => normalizeNumber(current) === normalizeNumber(inferred.number) ? metadata.patent_number || current : current);
    setCountryCode((current) => current || metadata.country_code || '');
    setPublicationDate((current) => current || metadata.publication_date || '');
    setAssignee((current) => current || metadata.assignee || '');
    setAbstractText((current) => current || metadata.abstract || '');
    setLookupMessage('Yayın bilgileri otomatik dolduruldu. Kaydetmeden önce kontrol edebilirsiniz.');
  }

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
      <div className="form-heading"><Link href="/">← Kütüphaneye dön</Link><p className="eyebrow">KONTROLLÜ İŞ AKIŞI</p><h1>Yeni patent ekle</h1><p>PDF’den yayın bilgilerini otomatik getirin; tüm alanları kaydetmeden önce düzenleyin.</p></div>
      <form className="patent-form" onSubmit={submit}>
        {error && <p className="form-message error">{error}</p>}
        <section><h2>01 · PDF ve temel bilgiler</h2><div className="field-grid">
          <label className="full">Patent PDF <input name="pdf" onChange={selectPdf} type="file" accept="application/pdf,.pdf" required /><small>Özel bucket’ta saklanır · En fazla 50 MB</small></label>
          {lookupMessage && <p className={`form-message full ${lookupBusy ? '' : 'success'}`}>{lookupMessage}</p>}
          <label className="full">Başlık <input name="title" onChange={(event) => setTitle(event.target.value)} required maxLength={500} value={title} /></label>
          <label>Patent numarası <input name="patent_number" onChange={(event) => setPatentNumber(event.target.value)} placeholder="EP 3 821 947 A1" value={patentNumber} /></label>
          <label>Ülke kodu <input name="country_code" onChange={(event) => setCountryCode(event.target.value)} placeholder="EP" maxLength={8} value={countryCode} /></label>
          <label>Yayın tarihi <input name="publication_date" onChange={(event) => setPublicationDate(event.target.value)} type="date" value={publicationDate} /></label>
          <label>Hak sahibi / firma <input name="assignee" onChange={(event) => setAssignee(event.target.value)} value={assignee} /></label>
          <label className="full">Kısa özet <textarea name="user_summary" rows={3} /></label>
          <label className="full">Abstract <textarea name="abstract_text" onChange={(event) => setAbstractText(event.target.value)} rows={4} value={abstractText} /></label>
          <label className="full">Notlar <textarea name="notes" rows={3} /></label>
        </div></section>
        <section><h2>02 · Uygulama ve teknik amaç</h2><div className="choice-grid"><ChoiceGroup name="category_ids" title="Uygulama kategorileri" items={categories} /><ChoiceGroup name="purpose_ids" title="Teknik amaçlar" items={purposes} /></div></section>
        <section><h2>03 · Kimyasallar ve rolleri</h2><label className="role-select">Seçilen kimyasalların rolü<select name="chemical_role_id" defaultValue=""><option value="" disabled>Manuel rol seçin</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><div className="chemical-picker">{chemicals.map((chemical) => <label key={chemical.id}><input type="checkbox" name="chemical_ids" value={chemical.id} /><span><strong>{chemical.abbreviation || chemical.canonical_name}</strong><small>{chemical.canonical_name}{chemical.cas_number ? ` · CAS ${chemical.cas_number}` : ''}</small></span></label>)}</div></section>
        <section><h2>04 · Özel etiketler</h2><label>Virgülle ayırın<input name="tags" placeholder="rakip, yüksek Tg, incelenecek" /></label></section>
        <div className="form-footer"><button disabled={busy || lookupBusy} className="primary-action" type="submit">{lookupBusy ? 'Yayın bilgileri getiriliyor…' : busy ? 'Kaydediliyor…' : 'PDF’yi yükle ve patenti kaydet'}</button></div>
      </form>
    </div>
  );
}

type PatentMetadata = {
  title: string | null;
  patent_number: string | null;
  country_code: string | null;
  publication_date: string | null;
  assignee: string | null;
  abstract: string | null;
};

function normalizeNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function inferPatentNumber(filename: string) {
  const normalized = normalizeNumber(filename.replace(/\.pdf$/i, ''));
  const match = normalized.match(/([A-Z]{2})(\d{4,})([A-Z]\d?)?/);
  return match ? { country: match[1], number: `${match[1]}${match[2]}${match[3] ?? ''}` } : null;
}

function ChoiceGroup({ items, name, title }: { items: Named[]; name: string; title: string }) {
  return <fieldset><legend>{title}</legend>{items.map((item) => <label key={item.id}><input type="checkbox" name={name} value={item.id} />{item.name}</label>)}</fieldset>;
}
