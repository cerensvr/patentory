import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

function metaTags(html: string) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => {
    const attributes: Record<string, string> = {};
    for (const attribute of match[0].matchAll(/([\w.-]+)\s*=\s*(["'])(.*?)\2/gis)) attributes[attribute[1].toLowerCase()] = decodeHtml(attribute[3]);
    return attributes;
  });
}

function meta(tags: Array<Record<string, string>>, name: string, scheme?: string) {
  return tags.find((tag) => tag.name?.toLowerCase() === name.toLowerCase() && (!scheme || tag.scheme?.toLowerCase() === scheme.toLowerCase()))?.content ?? null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'Yalnızca POST desteklenir.' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey) return json({ error: 'Sunucu yapılandırması eksik.' }, 500);
  if (!authorization) return json({ error: 'Oturum gerekli.' }, 401);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return json({ error: 'Oturum doğrulanamadı.' }, 401);

  let requested = '';
  try {
    const body = await request.json();
    requested = String(body?.patentNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch {
    return json({ error: 'Geçersiz istek.' }, 400);
  }
  const numberMatch = requested.match(/^([A-Z]{2})(\d{4,})([A-Z]\d?)?$/);
  if (!numberMatch) return json({ error: 'Dosya adında tanınabilir bir patent numarası bulunamadı.', code: 'PATENT_NUMBER_NOT_RECOGNIZED' }, 422);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const sourceUrl = `https://patents.google.com/patent/${encodeURIComponent(requested)}/en`;
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html', 'User-Agent': 'Patentory/1.0 patent metadata lookup' },
    });
    if (!response.ok) return json({ error: 'Patent kaynağında eşleşme bulunamadı.', code: 'PATENT_NOT_FOUND' }, 404);
    const html = (await response.text()).slice(0, 3_000_000);
    const tags = metaTags(html);
    const title = meta(tags, 'DC.title');
    if (!title) return json({ error: 'Patent bilgileri doğrulanamadı.', code: 'METADATA_NOT_FOUND' }, 404);
    const titleNumber = decodeHtml(html.match(/<title>\s*([A-Z]{2}\d+[A-Z]\d?)/i)?.[1] ?? requested).toUpperCase();
    const result = {
      title,
      patent_number: titleNumber,
      country_code: numberMatch[1],
      publication_date: meta(tags, 'DC.date', 'issue'),
      assignee: meta(tags, 'DC.contributor', 'assignee'),
      abstract: meta(tags, 'DC.description'),
      source_url: sourceUrl,
    };
    return json({ metadata: result });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    return json({
      error: timedOut ? 'Patent bilgisi sorgusu zaman aşımına uğradı; alanları manuel doldurabilirsiniz.' : 'Patent kaynağına şu anda ulaşılamıyor; alanları manuel doldurabilirsiniz.',
      code: timedOut ? 'LOOKUP_TIMEOUT' : 'LOOKUP_UNAVAILABLE',
    }, 503);
  } finally {
    clearTimeout(timeout);
  }
});
