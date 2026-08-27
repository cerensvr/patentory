import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';

type LibraryPageProps = { searchParams: Promise<{ q?: string; favorites?: string; chemical?: string; category?: string | string[]; purpose?: string | string[] }> };

function values(value?: string | string[]) {
  return value ? (Array.isArray(value) ? value : [value]) : [];
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const selectedCategories = values(params.category);
  const selectedPurposes = values(params.purpose);
  const [{ count: chemicalCount }, chemicalResult, categoryResult, purposeResult] = await Promise.all([
    supabase.from('chemicals').select('*', { count: 'exact', head: true }),
    params.chemical
      ? supabase.rpc('search_chemical_concepts', { p_query: params.chemical, p_limit: 12 })
      : Promise.resolve({ data: null }),
    supabase.from('application_categories').select('id,name').order('name'),
    supabase.from('technical_purposes').select('id,name').order('name'),
  ]);
  const chemicalMatches = chemicalResult.data;
  const { data: patents, error } = await supabase.rpc('search_patents', {
    p_query: params.q?.trim() || undefined,
    p_favorite_only: params.favorites === '1',
    p_application_category_ids: selectedCategories.length ? selectedCategories : undefined,
    p_technical_purpose_ids: selectedPurposes.length ? selectedPurposes : undefined,
    p_chemical_ids: chemicalMatches?.[0]?.chemical_id ? [chemicalMatches[0].chemical_id] : undefined,
    p_limit: 60,
  });

  if (error) throw new Error(error.message);
  const items = patents ?? [];
  const favoriteCount = items.filter((patent) => patent.favorite).length;

  return (
    <AppShell email={user.email ?? 'Kullanıcı'}>
      <header className="topbar">
        <form className="search-box" action="/">
          <span>⌕</span><input name="q" defaultValue={params.q} placeholder="Başlık, patent numarası, firma ara…" />
          <button type="submit">Ara</button>
        </form>
        <Link className="upload-button" href="/patents/new"><span>＋</span>Patent ekle</Link>
      </header>
      <div className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow">YAPILANDIRILMIŞ AR-GE ARŞİVİNİZ</p><h1>Patent kütüphanesi</h1><p>PDF’lerin içindeki kimya, uygulama ve performans bilgisini daha sonra kolayca bulun.</p></div></div>
        <section className="metric-row">
          <article><span>Görünen patent</span><strong>{items.length}</strong><small>Mevcut filtre sonucu</small></article>
          <article><span>Favoriler</span><strong>{favoriteCount}</strong><small>Hızlı erişim listesi</small></article>
          <article><span>Kimyasal kayıtları</span><strong>{chemicalCount ?? 0}</strong><small>Sinonim ve ürün eşleşmeleri dahil</small></article>
          <article className="accent-metric"><span>AI durumu</span><strong>Opsiyonel</strong><small>Manuel akış her zaman açık</small></article>
        </section>
        <div className="library-layout">
          <aside className="filters">
            <div className="filter-heading"><strong>Filtreler</strong><Link href="/">Temizle</Link></div>
            <form action="/" className="filter-stack">
              <label className="filter-search"><span>◇</span><input name="chemical" defaultValue={params.chemical} placeholder="IPDA, VESTAMIN…" /></label>
              <label className="check-row"><input name="favorites" value="1" type="checkbox" defaultChecked={params.favorites === '1'} /> Sadece favoriler</label>
              <fieldset className="filter-options"><legend>Uygulama</legend>{categoryResult.data?.map((item) => <label className="check-row" key={item.id}><input name="category" value={item.id} type="checkbox" defaultChecked={selectedCategories.includes(item.id)} />{item.name}</label>)}</fieldset>
              <fieldset className="filter-options"><legend>Teknik amaç</legend>{purposeResult.data?.map((item) => <label className="check-row" key={item.id}><input name="purpose" value={item.id} type="checkbox" defaultChecked={selectedPurposes.includes(item.id)} />{item.name}</label>)}</fieldset>
              <button className="secondary-action" type="submit">Filtrele</button>
            </form>
            {chemicalMatches && chemicalMatches.length > 0 && <div className="concept-results"><small>KİMYASAL EŞLEŞMELERİ</small>{chemicalMatches.map((item) => <div key={item.chemical_id}><strong>{item.abbreviation || item.canonical_name}</strong><span>{item.canonical_name}</span><em>{[...item.synonyms, ...item.commercial_product_names].join(' · ')}</em></div>)}</div>}
          </aside>
          <section className="results">
            <div className="results-toolbar"><p><strong>{items.length} patent</strong> bulundu</p><span>En yeni eklenenler</span></div>
            {items.length === 0 ? <div className="empty-web"><span>P</span><h2>Kütüphaneniz hazır.</h2><p>İlk PDF’nizi ekleyip bilgileri manuel sınıflandırın.</p><Link className="primary-action" href="/patents/new">İlk patenti ekle</Link></div> :
              <div className="patent-grid">{items.map((patent, index) => (
                <Link className="patent-card" href={`/patents/${patent.id}`} key={patent.id}>
                  <div className="card-topline"><span className={`country-badge ${['mint','amber','blue'][index % 3]}`}>{patent.country_code ?? '—'}</span><span>{patent.patent_number ?? 'TASLAK'}</span><b>{patent.favorite ? '★' : '☆'}</b></div>
                  <h2>{patent.title ?? 'Başlıksız patent'}</h2><p className="assignee">{patent.assignee ?? 'Hak sahibi girilmedi'}{patent.publication_date ? ` · ${patent.publication_date.slice(0, 4)}` : ''}</p>
                  <div className="application-tags">{patent.application_names.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className="card-section"><small>ANA MALZEMELER</small><div className="chemical-list">{patent.material_names.slice(0, 5).map((name) => <span key={name}>{name}</span>)}</div></div>
                  <div className="card-section purpose-line"><small>TEKNİK AMAÇ</small><p>{patent.technical_purpose_names.join(' · ') || 'Teknik amaç eklenmedi'}</p></div>
                  <footer><span className="status-dot" />{patent.ai_analysis_status === 'NOT_ANALYZED' ? 'Manuel kayıt' : patent.ai_analysis_status}<b>↗</b></footer>
                </Link>
              ))}</div>}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
