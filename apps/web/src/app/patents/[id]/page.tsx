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

  const [{ data: patent }, categories, purposes, materials, tags, runResult, categoryCatalog, purposeCatalog, chemicalCatalog, productCatalog, roleCatalog] = await Promise.all([
    supabase.from('patents').select('*').eq('id', id).eq('owner_user_id', user.id).maybeSingle(),
    supabase.from('patent_application_categories').select('application_categories(id,name)').eq('patent_id', id),
    supabase.from('patent_technical_purposes').select('technical_purposes(id,name)').eq('patent_id', id),
    supabase.from('patent_chemicals').select('id,raw_material_name,chemicals(id,canonical_name,abbreviation),commercial_products(id,trade_name),chemical_roles(id,name)').eq('patent_id', id),
    supabase.from('patent_tags').select('tags(name)').eq('patent_id', id),
    supabase.from('ai_analysis_runs').select('*').eq('patent_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('application_categories').select('id,name').or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`).order('name'),
    supabase.from('technical_purposes').select('id,name').or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`).order('name'),
    supabase.from('chemicals').select('id,canonical_name,abbreviation,cas_number,chemical_class').or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`).order('canonical_name'),
    supabase.from('commercial_products').select('id,trade_name,manufacturer,product_type').or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`).order('trade_name'),
    supabase.from('chemical_roles').select('id,name').order('name'),
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
        categories={categories.data?.flatMap((row) => row.application_categories ? [{ id: row.application_categories.id, name: row.application_categories.name }] : []) ?? []}
        purposes={purposes.data?.flatMap((row) => row.technical_purposes ? [{ id: row.technical_purposes.id, name: row.technical_purposes.name }] : []) ?? []}
        materials={materials.data?.map((row) => ({
          id: row.id,
          chemicalId: row.chemicals?.id ?? null,
          commercialProductId: row.commercial_products?.id ?? null,
          roleId: row.chemical_roles?.id ?? null,
          rawName: row.raw_material_name,
          name: row.chemicals?.abbreviation || row.chemicals?.canonical_name || row.commercial_products?.trade_name || row.raw_material_name || 'Malzeme',
          role: row.chemical_roles?.name ?? 'Rol yok',
        })) ?? []}
        categoryOptions={categoryCatalog.data ?? []}
        purposeOptions={purposeCatalog.data ?? []}
        chemicalOptions={chemicalCatalog.data ?? []}
        commercialProductOptions={productCatalog.data ?? []}
        roleOptions={roleCatalog.data ?? []}
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
