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

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return response({ error: 'Oturum doğrulanamadı.' }, 401);

  const { data: patents, error: patentError } = await serviceClient
    .from('patents')
    .select('pdf_storage_path')
    .eq('owner_user_id', data.user.id)
    .not('pdf_storage_path', 'is', null);
  if (patentError) return response({ error: 'Hesap verileri hazırlanamadı.' }, 500);

  const paths = (patents ?? []).flatMap((patent) => patent.pdf_storage_path ? [patent.pdf_storage_path] : []);
  for (let index = 0; index < paths.length; index += 100) {
    const { error: storageError } = await serviceClient.storage.from('patent-pdfs').remove(paths.slice(index, index + 100));
    if (storageError) return response({ error: 'Özel PDF dosyaları silinemedi. Hesap korunarak işlem durduruldu.' }, 500);
  }

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(data.user.id, false);
  if (deleteError) return response({ error: 'Hesap silinemedi. Daha sonra tekrar deneyin.' }, 500);
  return response({ deleted: true });
});
