import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const headers = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return response({ error: 'Yalnızca POST desteklenir.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Sunucu yapılandırması eksik.' }, 500);
  if (!authorization) return response({ error: 'Oturum gerekli.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return response({ error: 'Oturum doğrulanamadı.' }, 401);

  let suggestionId = '';
  let decision = '';
  try {
    const body = await request.json(); suggestionId = String(body?.suggestionId ?? ''); decision = String(body?.decision ?? '');
  } catch { return response({ error: 'Geçersiz istek.' }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(suggestionId) || !['ACCEPTED', 'REJECTED'].includes(decision)) return response({ error: 'Geçersiz öneri veya karar.' }, 400);

  const { data: suggestion, error: suggestionError } = await serviceClient.from('ai_analysis_suggestions').select('*').eq('id', suggestionId).eq('owner_user_id', authData.user.id).maybeSingle();
  if (suggestionError || !suggestion) return response({ error: 'Öneri bulunamadı veya erişim yetkiniz yok.' }, 404);
  if (suggestion.review_status !== 'PENDING') return response({ status: suggestion.review_status });

  if (decision === 'ACCEPTED') {
    if (suggestion.suggestion_type === 'CHEMICAL' || suggestion.suggestion_type === 'COMMERCIAL_PRODUCT') {
      const roleId = suggestion.matched_role_id;
      if (!roleId) return response({ error: 'Kimyasal rolü eşleştirilemedi.' }, 422);
      const rawName = !suggestion.matched_chemical_id && !suggestion.matched_commercial_product_id ? suggestion.label : null;
      let existingQuery = serviceClient.from('patent_chemicals').select('id').eq('patent_id', suggestion.patent_id).eq('chemical_role_id', roleId);
      existingQuery = suggestion.matched_chemical_id ? existingQuery.eq('chemical_id', suggestion.matched_chemical_id) : existingQuery.is('chemical_id', null);
      existingQuery = suggestion.matched_commercial_product_id ? existingQuery.eq('commercial_product_id', suggestion.matched_commercial_product_id) : existingQuery.is('commercial_product_id', null);
      existingQuery = rawName ? existingQuery.ilike('raw_material_name', rawName) : existingQuery.is('raw_material_name', null);
      const { data: existing } = await existingQuery.limit(1).maybeSingle();
      if (!existing) {
        const { error } = await serviceClient.from('patent_chemicals').insert({ patent_id: suggestion.patent_id, chemical_id: suggestion.matched_chemical_id, commercial_product_id: suggestion.matched_commercial_product_id, chemical_role_id: roleId, raw_material_name: rawName, confidence_score: suggestion.confidence_score, source_type: 'AI', ai_suggested: true, user_confirmed: true, source_page: suggestion.evidence_page, source_quote: suggestion.evidence_quote });
        if (error) return response({ error: 'Kimyasal önerisi kaydedilemedi.' }, 500);
      }
    } else if (suggestion.suggestion_type === 'APPLICATION_CATEGORY') {
      if (!suggestion.matched_category_id) return response({ error: 'Katalog eşleşmesi olmayan kategori onaylanamaz.' }, 422);
      const { error } = await serviceClient.from('patent_application_categories').upsert({ patent_id: suggestion.patent_id, category_id: suggestion.matched_category_id }, { onConflict: 'patent_id,category_id', ignoreDuplicates: true });
      if (error) return response({ error: 'Uygulama kategorisi kaydedilemedi.' }, 500);
    } else if (suggestion.suggestion_type === 'TECHNICAL_PURPOSE') {
      if (!suggestion.matched_purpose_id) return response({ error: 'Katalog eşleşmesi olmayan teknik amaç onaylanamaz.' }, 422);
      const { error } = await serviceClient.from('patent_technical_purposes').upsert({ patent_id: suggestion.patent_id, purpose_id: suggestion.matched_purpose_id }, { onConflict: 'patent_id,purpose_id', ignoreDuplicates: true });
      if (error) return response({ error: 'Teknik amaç kaydedilemedi.' }, 500);
    }
  }

  const { error: reviewError } = await serviceClient.from('ai_analysis_suggestions').update({ review_status: decision, reviewed_at: new Date().toISOString() }).eq('id', suggestion.id).eq('owner_user_id', authData.user.id);
  if (reviewError) return response({ error: 'Öneri durumu güncellenemedi.' }, 500);
  const { count } = await serviceClient.from('ai_analysis_suggestions').select('id', { count: 'exact', head: true }).eq('run_id', suggestion.run_id).eq('review_status', 'PENDING');
  if ((count ?? 0) === 0) {
    await Promise.all([
      serviceClient.from('ai_analysis_runs').update({ status: 'COMPLETED' }).eq('id', suggestion.run_id).eq('owner_user_id', authData.user.id),
      serviceClient.from('patents').update({ ai_analysis_status: 'COMPLETED' }).eq('id', suggestion.patent_id).eq('owner_user_id', authData.user.id),
    ]);
  }
  return response({ status: decision });
});
