'use client';

import type { Database } from '@patent-knowledge/supabase/database.types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

type Patent = Database['public']['Tables']['patents']['Row'];

export function PatentEditor({ patent, signedPdfUrl, categories, purposes, materials, tags, userId }: {
  patent: Patent;
  signedPdfUrl: string | null;
  categories: string[];
  purposes: string[];
  materials: { id: string; name: string; role: string }[];
  tags: string[];
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

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
          <label className="full">Kısa özet<textarea name="user_summary" rows={4} defaultValue={patent.user_summary ?? ''} /></label>
          <label className="full">Notlar<textarea name="notes" rows={5} defaultValue={patent.notes ?? ''} /></label>
          <label className="check-row"><input type="checkbox" name="favorite" defaultChecked={patent.favorite} /> Favori</label>
          <label className="check-row"><input type="checkbox" name="archived" defaultChecked={patent.archived} /> Arşivlendi</label>
        </div><button className="primary-action" disabled={busy} type="submit">{busy ? 'İşleniyor…' : 'Değişiklikleri kaydet'}</button></form>
        <aside className="structure-card"><h2>Yapılandırılmış bilgi</h2><Structure title="Uygulamalar" values={categories} /><Structure title="Teknik amaçlar" values={purposes} /><div className="structure-section"><small>KİMYASALLAR VE ROLLER</small>{materials.length ? materials.map((item) => <span key={item.id}><strong>{item.name}</strong><em>{item.role}</em></span>) : <p>Kimyasal seçilmedi.</p>}</div><Structure title="Özel etiketler" values={tags} /><div className="secure-file"><small>ÖZEL PDF</small><strong>{patent.pdf_original_filename ?? 'PDF yok'}</strong><p>{patent.pdf_size_bytes ? `${(patent.pdf_size_bytes / 1024 / 1024).toFixed(1)} MB` : 'Dosya eklenmedi'} · Bağlantı 15 dakika geçerlidir.</p></div></aside>
      </div>
    </div>
  );
}

function Structure({ title, values }: { title: string; values: string[] }) {
  return <div className="structure-section"><small>{title.toUpperCase()}</small><div>{values.length ? values.map((value) => <span key={value}>{value}</span>) : <p>Henüz eklenmedi.</p>}</div></div>;
}
