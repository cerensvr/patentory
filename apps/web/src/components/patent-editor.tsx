'use client';

import type { Database } from '@patent-knowledge/supabase/database.types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

type Patent = Database['public']['Tables']['patents']['Row'];
type Named = { id: string; name: string };
type Material = { id: string; chemicalId: string | null; commercialProductId: string | null; roleId: string | null; rawName: string | null; name: string; role: string };
type ChemicalOption = { id: string; canonical_name: string; abbreviation: string | null; cas_number: string | null; chemical_class: string | null };
type CommercialProductOption = { id: string; trade_name: string; manufacturer: string | null; product_type: string | null };

export function PatentEditor({ patent, signedPdfUrl, categories, purposes, materials, tags, userId, categoryOptions, purposeOptions, chemicalOptions, commercialProductOptions, roleOptions }: {
  patent: Patent;
  signedPdfUrl: string | null;
  categories: Named[];
  purposes: Named[];
  materials: Material[];
  tags: string[];
  userId: string;
  categoryOptions: Named[];
  purposeOptions: Named[];
  chemicalOptions: ChemicalOption[];
  commercialProductOptions: CommercialProductOption[];
  roleOptions: Named[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [structureEditing, setStructureEditing] = useState(false);
  const [structureMessage, setStructureMessage] = useState<string>();
  const [categoryIds, setCategoryIds] = useState(() => categories.map((item) => item.id));
  const [purposeIds, setPurposeIds] = useState(() => purposes.map((item) => item.id));
  const [chemicalIds, setChemicalIds] = useState(() => materials.flatMap((item) => item.chemicalId ? [item.chemicalId] : []));
  const [productIds, setProductIds] = useState(() => materials.flatMap((item) => item.commercialProductId ? [item.commercialProductId] : []));
  const [keptRawMaterialIds, setKeptRawMaterialIds] = useState(() => materials.flatMap((item) => item.rawName ? [item.id] : []));
  const [roleByChemical, setRoleByChemical] = useState<Record<string, string>>(() => Object.fromEntries(materials.flatMap((item) => item.chemicalId && item.roleId ? [[item.chemicalId, item.roleId]] : [])));
  const [roleByProduct, setRoleByProduct] = useState<Record<string, string>>(() => Object.fromEntries(materials.flatMap((item) => item.commercialProductId && item.roleId ? [[item.commercialProductId, item.roleId]] : [])));
  const [chemicalQuery, setChemicalQuery] = useState('');
  const visibleChemicals = useMemo(() => {
    const query = chemicalQuery.trim().toLocaleLowerCase('tr-TR');
    if (!query) return chemicalOptions;
    return chemicalOptions.filter((chemical) => `${chemical.abbreviation ?? ''} ${chemical.canonical_name} ${chemical.cas_number ?? ''} ${chemical.chemical_class ?? ''}`.toLocaleLowerCase('tr-TR').includes(query));
  }, [chemicalOptions, chemicalQuery]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim() || null;
    const { error } = await createClient().from('patents').update({
      title: text('title'), patent_number: text('patent_number'), assignee: text('assignee'),
      country_code: text('country_code')?.toUpperCase() ?? null,
      publication_date: text('publication_date'), user_summary: text('user_summary'), notes: text('notes'),
      favorite: form.get('favorite') === 'on', archived: form.get('archived') === 'on',
    }).eq('id', patent.id).eq('owner_user_id', userId);
    setBusy(false); setMessage(error ? error.message : 'Değişiklikler kaydedildi.');
    if (!error) router.refresh();
  }

  async function remove() {
    if (!window.confirm('Bu patenti ve PDF dosyasını kalıcı olarak silmek istiyor musunuz?')) return;
    setBusy(true);
    const supabase = createClient();
    if (patent.pdf_storage_path) await supabase.storage.from('patent-pdfs').remove([patent.pdf_storage_path]);
    const { error } = await supabase.from('patents').delete().eq('id', patent.id).eq('owner_user_id', userId);
    if (error) { setMessage(error.message); setBusy(false); return; }
    router.replace('/'); router.refresh();
  }

  async function saveStructure() {
    const missingChemicalRole = chemicalIds.find((id) => !roleByChemical[id]);
    const missingProductRole = productIds.find((id) => !roleByProduct[id]);
    if (missingChemicalRole || missingProductRole) {
      setStructureMessage('Seçilen her kimyasal ve ticari ürün için bir rol belirleyin.');
      return;
    }
    setBusy(true);
    setStructureMessage(undefined);
    const supabase = createClient();

    const existingChemicalById = new Map(materials.flatMap((item) => item.chemicalId ? [[item.chemicalId, item]] : []));
    const existingProductById = new Map(materials.flatMap((item) => item.commercialProductId ? [[item.commercialProductId, item]] : []));
    const deleteMaterialIds = materials.filter((item) => (
      (item.chemicalId && !chemicalIds.includes(item.chemicalId))
      || (item.commercialProductId && !productIds.includes(item.commercialProductId))
      || (item.rawName && !keptRawMaterialIds.includes(item.id))
    )).map((item) => item.id);

    const categoryDelete = await supabase.from('patent_application_categories').delete().eq('patent_id', patent.id);
    if (categoryDelete.error) return finishStructureError(categoryDelete.error.message);
    if (categoryIds.length) {
      const { error } = await supabase.from('patent_application_categories').insert(categoryIds.map((category_id) => ({ patent_id: patent.id, category_id })));
      if (error) return finishStructureError(error.message);
    }
    const purposeDelete = await supabase.from('patent_technical_purposes').delete().eq('patent_id', patent.id);
    if (purposeDelete.error) return finishStructureError(purposeDelete.error.message);
    if (purposeIds.length) {
      const { error } = await supabase.from('patent_technical_purposes').insert(purposeIds.map((purpose_id) => ({ patent_id: patent.id, purpose_id })));
      if (error) return finishStructureError(error.message);
    }
    if (deleteMaterialIds.length) {
      const { error } = await supabase.from('patent_chemicals').delete().eq('patent_id', patent.id).in('id', deleteMaterialIds);
      if (error) return finishStructureError(error.message);
    }
    for (const chemicalId of chemicalIds) {
      const existing = existingChemicalById.get(chemicalId);
      if (existing) {
        const { error } = await supabase.from('patent_chemicals').update({ chemical_role_id: roleByChemical[chemicalId], user_confirmed: true }).eq('id', existing.id).eq('patent_id', patent.id);
        if (error) return finishStructureError(error.message);
      }
    }
    for (const productId of productIds) {
      const existing = existingProductById.get(productId);
      if (existing) {
        const { error } = await supabase.from('patent_chemicals').update({ chemical_role_id: roleByProduct[productId], user_confirmed: true }).eq('id', existing.id).eq('patent_id', patent.id);
        if (error) return finishStructureError(error.message);
      }
    }
    const newChemicalRows = chemicalIds.filter((id) => !existingChemicalById.has(id)).map((chemical_id) => ({ patent_id: patent.id, chemical_id, chemical_role_id: roleByChemical[chemical_id], source_type: 'MANUAL', user_confirmed: true }));
    const newProductRows = productIds.filter((id) => !existingProductById.has(id)).map((commercial_product_id) => ({ patent_id: patent.id, commercial_product_id, chemical_role_id: roleByProduct[commercial_product_id], source_type: 'MANUAL', user_confirmed: true }));
    if (newChemicalRows.length || newProductRows.length) {
      const { error } = await supabase.from('patent_chemicals').insert([...newChemicalRows, ...newProductRows]);
      if (error) return finishStructureError(error.message);
    }

    setBusy(false);
    setStructureEditing(false);
    setStructureMessage('Yapılandırılmış bilgiler kaydedildi.');
    router.refresh();
  }

  function finishStructureError(error: string) {
    setBusy(false);
    setStructureMessage(error);
  }

  return (
    <div className="detail-page">
      <div className="detail-topbar"><Link href="/">← Kütüphaneye dön</Link><div>{signedPdfUrl && <a className="secondary-action" href={signedPdfUrl} target="_blank" rel="noreferrer">PDF’yi güvenli aç</a>}<button className="danger-action" disabled={busy} onClick={remove}>Sil</button></div></div>
      <div className="detail-hero"><span className="country-badge mint">{patent.country_code ?? '—'}</span><div><p className="eyebrow">{patent.patent_number ?? 'PATENT TASLAĞI'}</p><h1>{patent.title ?? 'Başlıksız patent'}</h1><p>{patent.assignee ?? 'Hak sahibi eklenmedi'} · {new Date(patent.uploaded_at).toLocaleDateString('tr-TR')}</p></div></div>
      <div className="detail-layout">
        <form className="edit-card" id="manual-patent-editor" onSubmit={save}><h2>Patent bilgileri</h2>{message && <p className={`form-message ${message.includes('kaydedildi') ? 'success' : 'error'}`}>{message}</p>}<div className="field-grid">
          <label className="full">Başlık<input name="title" defaultValue={patent.title ?? ''} /></label>
          <label>Patent numarası<input name="patent_number" defaultValue={patent.patent_number ?? ''} /></label>
          <label>Ülke kodu<input name="country_code" defaultValue={patent.country_code ?? ''} maxLength={8} /></label>
          <label>Yayın tarihi<input name="publication_date" type="date" defaultValue={patent.publication_date ?? ''} /></label>
          <label>Hak sahibi<input name="assignee" defaultValue={patent.assignee ?? ''} /></label>
          <label className="full">Türkçe abstract / özet<textarea name="user_summary" rows={4} defaultValue={patent.user_summary ?? ''} /></label>
          <label className="full">Notlar<textarea name="notes" rows={5} defaultValue={patent.notes ?? ''} /></label>
          <label className="check-row"><input type="checkbox" name="favorite" defaultChecked={patent.favorite} /> Favori</label>
          <label className="check-row"><input type="checkbox" name="archived" defaultChecked={patent.archived} /> Arşivlendi</label>
        </div><button className="primary-action" disabled={busy} type="submit">{busy ? 'İşleniyor…' : 'Değişiklikleri kaydet'}</button></form>
        <aside className={`structure-card ${structureEditing ? 'editing' : ''}`}>
          <div className="structure-card-heading"><h2>Yapılandırılmış bilgi</h2><button disabled={busy} onClick={() => { setStructureEditing((value) => !value); setStructureMessage(undefined); }} type="button">{structureEditing ? 'Vazgeç' : 'Düzenle'}</button></div>
          {structureMessage && <p className={`form-message ${structureMessage.includes('kaydedildi') ? 'success' : 'error'}`}>{structureMessage}</p>}
          {structureEditing ? <div className="structure-editor">
            <EditorChoiceGroup items={categoryOptions} label="Uygulamalar" selected={categoryIds} setSelected={setCategoryIds} />
            <EditorChoiceGroup items={purposeOptions} label="Teknik amaçlar" selected={purposeIds} setSelected={setPurposeIds} />
            <fieldset><legend>KİMYASALLAR VE ROLLER</legend><label className="structure-search">Katalogda ara<input onChange={(event) => setChemicalQuery(event.target.value)} placeholder="Ad, kısaltma, CAS veya sınıf" type="search" value={chemicalQuery} /></label><div className="structure-material-options">{visibleChemicals.map((chemical) => {
              const active = chemicalIds.includes(chemical.id);
              const label = chemical.abbreviation || chemical.canonical_name;
              return <article className={active ? 'active' : ''} key={chemical.id}><label><input checked={active} onChange={(event) => {
                setChemicalIds((current) => event.target.checked ? [...new Set([...current, chemical.id])] : current.filter((id) => id !== chemical.id));
                if (!event.target.checked) setRoleByChemical((current) => { const next = { ...current }; delete next[chemical.id]; return next; });
              }} type="checkbox" /><span><strong>{label}</strong><small>{chemical.canonical_name}{chemical.cas_number ? ` · CAS ${chemical.cas_number}` : ''}</small></span></label>{active && <select aria-label={`${label} rolü`} onChange={(event) => setRoleByChemical((current) => ({ ...current, [chemical.id]: event.target.value }))} value={roleByChemical[chemical.id] ?? ''}><option value="">Rol seçin</option>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</article>;
            })}</div></fieldset>
            <fieldset><legend>TİCARİ ÜRÜNLER VE ROLLER</legend><div className="structure-material-options">{commercialProductOptions.map((product) => {
              const active = productIds.includes(product.id);
              return <article className={active ? 'active product' : 'product'} key={product.id}><label><input checked={active} onChange={(event) => {
                setProductIds((current) => event.target.checked ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id));
                if (!event.target.checked) setRoleByProduct((current) => { const next = { ...current }; delete next[product.id]; return next; });
              }} type="checkbox" /><span><strong>{product.trade_name}</strong><small>{product.manufacturer || 'Üretici belirtilmemiş'}</small></span></label>{active && <select aria-label={`${product.trade_name} rolü`} onChange={(event) => setRoleByProduct((current) => ({ ...current, [product.id]: event.target.value }))} value={roleByProduct[product.id] ?? ''}><option value="">Rol seçin</option>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>}</article>;
            })}</div></fieldset>
            {!!materials.some((item) => item.rawName) && <fieldset><legend>KATALOĞA EŞLEŞMEYEN HAM ADLAR</legend>{materials.filter((item) => item.rawName).map((item) => <label className="raw-material-option" key={item.id}><input checked={keptRawMaterialIds.includes(item.id)} onChange={(event) => setKeptRawMaterialIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} type="checkbox" /><span><strong>{item.rawName}</strong><small>{item.role}</small></span></label>)}</fieldset>}
            <button className="primary-action structure-save" disabled={busy} onClick={saveStructure} type="button">{busy ? 'Kaydediliyor…' : 'Yapılandırılmış bilgiyi kaydet'}</button>
          </div> : <>
            <Structure title="Uygulamalar" values={categories.map((item) => translateCatalogLabel(item.name))} />
            <Structure title="Teknik amaçlar" values={purposes.map((item) => translateCatalogLabel(item.name))} />
            <div className="structure-section"><small>KİMYASALLAR VE ROLLER</small>{materials.length ? materials.map((item) => <span className={item.commercialProductId ? 'structure-product' : 'structure-chemical'} key={item.id}><strong>{item.name}</strong><em>{translateRole(item.role)}</em></span>) : <p>Kimyasal seçilmedi.</p>}</div>
            <Structure title="Özel etiketler" values={tags} />
          </>}
          <div className="secure-file"><small>ÖZEL PDF</small><strong>{patent.pdf_original_filename ?? 'PDF yok'}</strong><p>{patent.pdf_size_bytes ? `${(patent.pdf_size_bytes / 1024 / 1024).toFixed(1)} MB` : 'Dosya eklenmedi'} · Bağlantı 15 dakika geçerlidir.</p></div>
        </aside>
      </div>
    </div>
  );
}

function Structure({ title, values }: { title: string; values: string[] }) {
  return <div className="structure-section"><small>{title.toUpperCase()}</small><div>{values.length ? values.map((value) => <span key={value}>{value}</span>) : <p>Henüz eklenmedi.</p>}</div></div>;
}

function EditorChoiceGroup({ items, label, selected, setSelected }: { items: Named[]; label: string; selected: string[]; setSelected: (items: string[]) => void }) {
  return <fieldset><legend>{label.toUpperCase()}</legend><div className="structure-choice-grid">{items.map((item) => <label key={item.id}><input checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, item.id])] : selected.filter((id) => id !== item.id))} type="checkbox" /><span>{translateCatalogLabel(item.name)}</span></label>)}</div></fieldset>;
}

const CATALOG_TRANSLATIONS: Record<string, string> = {
  'epoxy foam': 'Epoksi köpük', 'potting': 'Elektronik dolgu / kapsülleme', 'high adhesion': 'Yüksek yapışma',
  'low density': 'Düşük yoğunluk', 'low viscosity': 'Düşük viskozite', 'low exotherm': 'Düşük ekzoterm',
  'fast cure': 'Hızlı kürlenme', 'long pot life': 'Uzun çalışma süresi', 'water resistance': 'Su direnci',
  'chemical resistance': 'Kimyasal direnç', 'flame retardancy': 'Alev geciktiricilik', 'high tg': 'Yüksek Tg',
};

function translateCatalogLabel(value: string) {
  return CATALOG_TRANSLATIONS[value.toLocaleLowerCase('en-US')] ?? value;
}

const ROLE_TRANSLATIONS: Record<string, string> = {
  'epoxy resin': 'Epoksi reçinesi', hardener: 'Sertleştirici', additive: 'Katkı',
  'blowing agent': 'Köpürtücü ajan', filler: 'Dolgu', surfactant: 'Yüzey aktif madde',
  catalyst: 'Katalizör', accelerator: 'Hızlandırıcı', diluent: 'Seyreltici', toughener: 'Toklaştırıcı',
};

function translateRole(value: string) {
  return ROLE_TRANSLATIONS[value.toLocaleLowerCase('en-US')] ?? value;
}
