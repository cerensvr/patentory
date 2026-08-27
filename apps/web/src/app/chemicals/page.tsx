import { redirect } from 'next/navigation';
import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';

import { createChemical, createCommercialProduct } from './actions';

type PageProps = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function ChemicalsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [chemicalResult, productResult] = await Promise.all([
    supabase.from('chemicals').select('id,owner_user_id,canonical_name,abbreviation,cas_number,molecular_formula,chemical_class,chemical_synonyms(synonym)').order('canonical_name'),
    supabase.from('commercial_products').select('id,owner_user_id,trade_name,manufacturer,product_type,description,commercial_product_chemicals(chemicals(id,canonical_name,abbreviation))').order('trade_name'),
  ]);
  const chemicals = chemicalResult.data ?? [];
  const products = productResult.data ?? [];

  return <AppShell email={user.email ?? 'Kullanıcı'}>
    <div className="catalog-page">
      <header className="catalog-heading"><div><p className="eyebrow">KAVRAM TABANLI MALZEME KATALOĞU</p><h1>Kimyasallar ve ticari ürünler</h1><p>Kanonik kimliği, sinonimleri ve ticari ürünleri birbirinden ayrı tutun.</p></div><Link className="secondary-action" href="/">Kütüphaneye dön</Link></header>
      {params.error && <p className="form-message error">{params.error}</p>}{params.message && <p className="form-message success">{params.message}</p>}
      <section className="catalog-explainer"><div><small>KANONİK</small><strong>Isophorone diamine</strong></div><span>≠</span><div><small>SİNONİM</small><strong>Isophoronediamine</strong></div><span>≠</span><div><small>TİCARİ ÜRÜN</small><strong>VESTAMIN IPD</strong></div></section>
      <div className="catalog-layout">
        <section className="catalog-list"><div className="catalog-title"><h2>Kimyasal kayıtları</h2><span>{chemicals.length} kayıt</span></div><div className="catalog-grid">{chemicals.map((chemical) => <article key={chemical.id}><div className="catalog-card-top"><span>{chemical.abbreviation || '—'}</span>{chemical.owner_user_id && <em>Size özel</em>}</div><h3>{chemical.canonical_name}</h3><p>{chemical.chemical_class ?? 'Sınıf eklenmedi'}{chemical.cas_number ? ` · CAS ${chemical.cas_number}` : ''}</p>{chemical.molecular_formula && <code>{chemical.molecular_formula}</code>}<div>{chemical.chemical_synonyms.map((item) => <small key={item.synonym}>{item.synonym}</small>)}</div></article>)}</div></section>
        <aside className="catalog-form"><h2>Kimyasal ekle</h2><form action={createChemical} className="compact-form"><label>Kanonik ad<input required name="canonical_name" /></label><div className="field-grid"><label>Kısaltma<input name="abbreviation" /></label><label>CAS numarası<input name="cas_number" /></label><label>Moleküler formül<input name="molecular_formula" /></label><label>Kimyasal sınıf<input name="chemical_class" /></label></div><label>Sinonimler<input name="synonyms" placeholder="Virgülle ayırın" /></label><label>Not<textarea name="notes" rows={3} /></label><button className="primary-action">Kimyasalı kaydet</button></form></aside>
      </div>
      <div className="catalog-layout products-layout">
        <section className="catalog-list"><div className="catalog-title"><h2>Ticari ürünler</h2><span>{products.length} kayıt</span></div><div className="product-list">{products.map((product) => <article key={product.id}><div><span>{product.product_type ?? 'Ticari ürün'}</span>{product.owner_user_id && <em>Size özel</em>}<h3>{product.trade_name}</h3><p>{product.manufacturer ?? 'Üretici eklenmedi'} · {product.description ?? 'Açıklama eklenmedi'}</p></div><div className="mapped-chemicals">{product.commercial_product_chemicals.length ? product.commercial_product_chemicals.map((mapping) => <small key={mapping.chemicals.id}>{mapping.chemicals.abbreviation || mapping.chemicals.canonical_name}</small>) : <small>Bileşimi bilinmiyor</small>}</div></article>)}</div></section>
        <aside className="catalog-form"><h2>Ticari ürün ekle</h2><form action={createCommercialProduct} className="compact-form"><label>Ticari ad<input required name="trade_name" /></label><label>Üretici<input name="manufacturer" /></label><label>Ürün türü<select name="product_type"><option value="PURE_SUBSTANCE">Saf madde</option><option value="MIXTURE">Karışım</option><option value="FORMULATED_PRODUCT">Formüle ürün</option><option value="UNKNOWN">Bilinmiyor</option></select></label><label>Açıklama<textarea name="description" rows={3} /></label><fieldset><legend>Bilinen kimyasal bileşenler</legend>{chemicals.map((chemical) => <label className="check-row" key={chemical.id}><input type="checkbox" name="chemical_ids" value={chemical.id} />{chemical.abbreviation || chemical.canonical_name}</label>)}</fieldset><button className="primary-action">Ticari ürünü kaydet</button></form></aside>
      </div>
    </div>
  </AppShell>;
}
