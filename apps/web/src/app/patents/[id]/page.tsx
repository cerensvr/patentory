import { notFound, redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { AiAnalysisPanel } from '@/components/ai-analysis-panel';
import { PatentEditor } from '@/components/patent-editor';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ id: string }> };

export default async function PatentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: patent }, categories, purposes, materials, tags, runResult] = await Promise.all([
    supabase.from('patents').select('*').eq('id', id).eq('owner_user_id', user.id).maybeSingle(),
    supabase.from('patent_application_categories').select('application_categories(name)').eq('patent_id', id),
    supabase.from('patent_technical_purposes').select('technical_purposes(name)').eq('patent_id', id),
    supabase.from('patent_chemicals').select('id,raw_material_name,chemicals(canonical_name,abbreviation),commercial_products(trade_name),chemical_roles(name)').eq('patent_id', id),
    supabase.from('patent_tags').select('tags(name)').eq('patent_id', id),
    supabase.from('ai_analysis_runs').select('*').eq('patent_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!patent) notFound();

  const suggestions = runResult.data
    ? await supabase.from('ai_analysis_suggestions').select('*').eq('run_id', runResult.data.id).order('confidence_score', { ascending: false })
    : { data: [] };

  let signedPdfUrl: string | null = null;
  if (patent.pdf_storage_path) {
    const { data } = await supabase.storage.from('patent-pdfs').createSignedUrl(patent.pdf_storage_path, 900);
    signedPdfUrl = data?.signedUrl ?? null;
  }

  return (
    <AppShell email={user.email ?? 'Kullanıcı'}>
      <PatentEditor
        patent={patent}
        signedPdfUrl={signedPdfUrl}
        categories={categories.data?.map((row) => row.application_categories?.name).filter(Boolean) ?? []}
        purposes={purposes.data?.map((row) => row.technical_purposes?.name).filter(Boolean) ?? []}
        materials={materials.data?.map((row) => ({
          id: row.id,
          name: row.chemicals?.abbreviation || row.chemicals?.canonical_name || row.commercial_products?.trade_name || row.raw_material_name || 'Malzeme',
          role: row.chemical_roles?.name ?? 'Rol yok',
        })) ?? []}
        tags={tags.data?.map((row) => row.tags?.name).filter(Boolean) ?? []}
        userId={user.id}
      />
      <AiAnalysisPanel
        patentId={patent.id}
        hasPdf={Boolean(patent.pdf_storage_path)}
        initialRun={runResult.data}
        initialSuggestions={suggestions.data ?? []}
      />
    </AppShell>
  );
}
