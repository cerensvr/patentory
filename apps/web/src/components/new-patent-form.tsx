'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, type ChangeEvent, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

type Named = { id: string; name: string };
type Chemical = { id: string; canonical_name: string; abbreviation: string | null; cas_number: string | null; chemical_class: string | null };
type CommercialProduct = { id: string; trade_name: string; manufacturer: string | null; product_type: string | null };
type LookupChemical = { chemical_id: string; role_id: string | null; confidence: number; evidence: string };
type LookupProduct = { commercial_product_id: string; role_id: string | null; confidence: number; evidence: string };
type LookupSuggestions = { category_ids: string[]; purpose_ids: string[]; chemicals: LookupChemical[]; commercial_products?: LookupProduct[] };

export function NewPatentForm({ categories, chemicals, commercialProducts, purposes, roles, userId }: {
  categories: Named[];
  chemicals: Chemical[];
  commercialProducts: CommercialProduct[];
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
  const visibleChemicals = chemicals.filter((chemical) => `${chemical.abbreviation ?? ''} ${chemical.canonical_name} ${chemical.cas_number ?? ''} ${chemical.chemical_class ?? ''}`.toLocaleLowerCase('tr').includes(chemicalQuery.trim().toLocaleLowerCase('tr')));

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
    const suggestions = data.suggestions as LookupSuggestions | undefined;
    if (suggestions) {
      const suggestedRoles = Object.fromEntries(suggestions.chemicals.filter((item) => item.role_id).map((item) => [item.chemical_id, item.role_id as string]));
      const suggestedChemicals = suggestions.chemicals.map((item) => item.chemical_id);
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
      const counts = [
        suggestions.category_ids.length ? `${suggestions.category_ids.length} kategori` : '',
        suggestions.purpose_ids.length ? `${suggestions.purpose_ids.length} teknik amaç` : '',
        suggestedChemicals.length ? `${suggestedChemicals.length} kimyasal` : '',
        suggestedProducts.length ? `${suggestedProducts.length} ticari ürün` : '',
      ].filter(Boolean).join(', ');
      setLookupMessage(counts
        ? `Yayın bilgileri dolduruldu; ${counts} kanıta göre önerildi. Kaydetmeden önce kontrol edin.`
        : 'Yayın bilgileri dolduruldu. Sınıflandırma için yeterli açık kanıt bulunmadı; seçimleri manuel yapabilirsiniz.');
    } else {
      setLookupMessage('Yayın bilgileri otomatik dolduruldu. Sınıflandırmayı manuel kontrol edin.');
    }
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
    const missingRole = chemicalIds.find((chemicalId) => !roleByChemical[chemicalId]);
    if (missingRole) {
      setError('Seçtiğiniz her kimyasal için patentteki rolünü de seçin.'); setBusy(false); return;
    }
    if (productIds.some((productId) => !roleByProduct[productId])) {
      setError('Seçtiğiniz her ticari ürün için patentteki rolünü de seçin.'); setBusy(false); return;
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

    const linkResults = await Promise.all([
      categoryIds.length ? supabase.from('patent_application_categories').insert(categoryIds.map((category_id) => ({ patent_id: patentId, category_id }))) : Promise.resolve({ error: null }),
      purposeIds.length ? supabase.from('patent_technical_purposes').insert(purposeIds.map((purpose_id) => ({ patent_id: patentId, purpose_id }))) : Promise.resolve({ error: null }),
      chemicalIds.length ? supabase.from('patent_chemicals').insert(chemicalIds.map((chemical_id) => ({ patent_id: patentId, chemical_id, chemical_role_id: roleByChemical[chemical_id], source_type: 'MANUAL', user_confirmed: true }))) : Promise.resolve({ error: null }),
      productIds.length ? supabase.from('patent_chemicals').insert(productIds.map((commercial_product_id) => ({ patent_id: patentId, commercial_product_id, chemical_role_id: roleByProduct[commercial_product_id], source_type: 'MANUAL', user_confirmed: true }))) : Promise.resolve({ error: null }),
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
          <label className="full">Türkçe abstract / özet <textarea name="user_summary" placeholder="PDF taramasının Türkçe özeti burada görünür; dilediğiniz gibi düzenleyebilirsiniz." rows={3} /></label>
          <label className="full">Orijinal abstract <textarea name="abstract_text" onChange={(event) => setAbstractText(event.target.value)} rows={4} value={abstractText} /></label>
          <label className="full">Notlar <textarea name="notes" rows={3} /></label>
        </div></section>
        <section><div className="section-title-row"><h2>02 · Uygulama ve teknik amaç</h2>{(suggestedCategoryIds.length > 0 || suggestedPurposeIds.length > 0) && <span className="auto-suggestion-badge">Otomatik öneri · kontrol edin</span>}</div><div className="choice-grid"><ChoiceGroup title="Uygulama kategorileri" items={categories} selected={categoryIds} suggested={suggestedCategoryIds} setSelected={setCategoryIds} /><ChoiceGroup title="Teknik amaçlar" items={purposes} selected={purposeIds} suggested={suggestedPurposeIds} setSelected={setPurposeIds} /></div></section>
        <section><div className="section-title-row"><h2>03 · Kimyasallar ve rolleri</h2>{suggestedChemicalIds.length > 0 && <span className="auto-suggestion-badge">Belgeden eşleşti · kontrol edin</span>}</div><p className="section-helper">Her kimyasalın rolü ayrı seçilir. İsim, kısaltma, CAS veya sınıfla katalog içinde arayabilirsiniz.</p><label className="chemical-catalog-search">Katalogda ara<input onChange={(event) => setChemicalQuery(event.target.value)} placeholder="DICY, anhidrit, amin, 461-58-5…" type="search" value={chemicalQuery} /></label><div className="chemical-picker">{visibleChemicals.map((chemical) => { const active = chemicalIds.includes(chemical.id); const suggested = suggestedChemicalIds.includes(chemical.id); return <div className={`chemical-card ${active ? 'active' : ''}`} key={chemical.id}><label><input checked={active} name="chemical_ids" onChange={(event) => { setChemicalIds((current) => event.target.checked ? [...new Set([...current, chemical.id])] : current.filter((id) => id !== chemical.id)); if (!event.target.checked) setRoleByChemical((current) => { const next = { ...current }; delete next[chemical.id]; return next; }); }} type="checkbox" value={chemical.id} /><span><strong>{chemical.abbreviation || chemical.canonical_name}{suggested && <em>Önerildi</em>}</strong><small>{chemical.canonical_name}{chemical.cas_number ? ` · CAS ${chemical.cas_number}` : ''}</small><small>{chemical.chemical_class ?? 'Sınıf eklenmedi'}</small></span></label>{active && <select aria-label={`${chemical.abbreviation || chemical.canonical_name} rolü`} onChange={(event) => setRoleByChemical((current) => ({ ...current, [chemical.id]: event.target.value }))} value={roleByChemical[chemical.id] ?? ''}><option value="" disabled>Bu kimyasalın rolünü seçin</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select>}</div>; })}</div>{visibleChemicals.length === 0 && <p className="section-helper">Bu aramayla eşleşen katalog kaydı bulunamadı.</p>}</section>
        <section><div className="section-title-row"><h2>04 · Ticari ürünler ve rolleri</h2>{suggestedProductIds.length > 0 && <span className="auto-suggestion-badge">Ticari ad eşleşti · kontrol edin</span>}</div><p className="section-helper">Ticari ürün saf kimyasal sayılmaz. Türü ve bilinen bileşen bağlantıları katalogda ayrı tutulur.</p><div className="chemical-picker">{commercialProducts.map((product) => { const active = productIds.includes(product.id); const suggested = suggestedProductIds.includes(product.id); return <div className={`chemical-card ${active ? 'active' : ''}`} key={product.id}><label><input checked={active} onChange={(event) => { setProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id)); if (!event.target.checked) setRoleByProduct((current) => { const next = { ...current }; delete next[product.id]; return next; }); }} type="checkbox" /><span><strong>{product.trade_name}{suggested && <em>Önerildi</em>}</strong><small>{product.manufacturer || 'Üretici belirsiz'} · {productTypeLabel(product.product_type)}</small></span></label>{active && <select aria-label={`${product.trade_name} rolü`} onChange={(event) => setRoleByProduct((current) => ({ ...current, [product.id]: event.target.value }))} value={roleByProduct[product.id] ?? ''}><option value="" disabled>Bu ürünün rolünü seçin</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select>}</div>; })}</div></section>
        <section><h2>05 · Özel etiketler</h2><label>Virgülle ayırın<input name="tags" placeholder="rakip, yüksek Tg, incelenecek" /></label></section>
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

function productTypeLabel(value: string | null) {
  if (value === 'PURE_SUBSTANCE' || value === 'PURE_CHEMICAL') return 'Saf madde olarak kayıtlı';
  if (value === 'MIXTURE') return 'Karışım';
  if (value === 'FORMULATED_PRODUCT') return 'Formüle ürün';
  return 'Türü doğrulanmalı';
}

function ChoiceGroup({ items, selected, setSelected, suggested, title }: { items: Named[]; selected: string[]; setSelected: (ids: string[]) => void; suggested: string[]; title: string }) {
  return <fieldset><legend>{title}</legend>{items.map((item) => { const active = selected.includes(item.id); return <label key={item.id}><input checked={active} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, item.id])] : selected.filter((id) => id !== item.id))} type="checkbox" value={item.id} />{item.name}{suggested.includes(item.id) && <em className="suggested-inline">önerildi</em>}</label>; })}</fieldset>;
}
