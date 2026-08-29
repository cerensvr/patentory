import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type Named = { id: string; name: string };
type Chemical = {
  id: string;
  canonical_name: string;
  abbreviation: string | null;
  chemical_class: string | null;
  chemical_synonyms?: Array<{ synonym: string }> | null;
};
type CommercialProduct = { id: string; trade_name: string; description: string | null; product_type: string | null };
type TextMatch = { evidence: string; confidence: number };

const CATEGORY_TERMS: Record<string, string[]> = {
  adhesive: ['adhesive', 'adhesion promoter', 'bonding composition'],
  'casting resin': ['casting resin', 'cast resin', 'resin casting'],
  coating: ['coating', 'coating composition', 'coated article'],
  composite: ['composite', 'fiber reinforced', 'fibre reinforced'],
  'epoxy foam': ['epoxy foam', 'foamed epoxy', 'epoxy foaming'],
  'laminating resin': ['laminating resin', 'lamination resin', 'resin laminate'],
  potting: ['potting compound', 'potting composition', 'encapsulation resin'],
  prepreg: ['prepreg', 'pre-impregnated'],
};

const PURPOSE_TERMS: Record<string, string[]> = {
  'chemical resistance': ['chemical resistance', 'chemically resistant', 'solvent resistance'],
  'fast cure': ['fast cure', 'rapid cure', 'short curing time', 'fast curing'],
  'flame retardancy': ['flame retardant', 'fire retardant', 'flame resistance'],
  'high adhesion': ['high adhesion', 'improved adhesion', 'excellent adhesion', 'bond strength'],
  'high tg': ['high tg', 'high glass transition temperature', 'elevated glass transition temperature'],
  'long pot life': ['long pot life', 'extended pot life', 'long working time'],
  'low density': ['low density', 'reduced density', 'lightweight'],
  'low exotherm': ['low exotherm', 'reduced exotherm', 'low heat generation'],
  'low viscosity': ['low viscosity', 'reduced viscosity'],
  'water resistance': ['water resistance', 'moisture resistance', 'hydrolytic resistance'],
};

const ROLE_TERMS: Record<string, string[]> = {
  accelerator: ['accelerator', 'curing accelerator'],
  'blowing agent': ['blowing agent', 'foaming agent'],
  catalyst: ['catalyst', 'initiator'],
  'epoxy resin': ['epoxy resin', 'epoxide resin', 'glycidyl ether', 'resin component'],
  'flame retardant': ['flame retardant', 'fire retardant'],
  filler: ['filler', 'reinforcement'],
  hardener: ['hardener', 'curing agent', 'cure agent', 'crosslinker', 'amine curing'],
  'reactive diluent': ['reactive diluent', 'epoxy diluent'],
  surfactant: ['surfactant', 'surface-active agent'],
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', ndash: '–', mdash: '—' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToText(value: string) {
  return decodeHtml(value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/li|\/div|\/h\d)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));
}

function sectionText(html: string, itemprop: string, maxLength: number) {
  const sections = [...html.matchAll(new RegExp(`<section\\b[^>]*itemprop=["']${itemprop}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'gi'))];
  return sections.map((match) => htmlToText(match[1])).join(' ').slice(0, maxLength);
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

function publicationDate(tags: Array<Record<string, string>>) {
  return tags.find((tag) => tag.name?.toLowerCase() === 'dc.date' && tag.scheme?.toLowerCase() !== 'datesubmitted')?.content ?? null;
}

async function fetchPatentPage(sourceUrl: string, signal: AbortSignal) {
  let lastStatus = 503;
  let bestHtml = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(sourceUrl, {
      signal,
      redirect: 'follow',
      headers: { Accept: 'text/html', 'User-Agent': 'Patentory/1.0 patent metadata lookup' },
    });
    lastStatus = response.status;
    if (response.ok) {
      const html = (await response.text()).slice(0, 3_000_000);
      if (html.length > bestHtml.length) bestHtml = html;
      const tags = metaTags(html);
      const hasBibliography = Boolean(meta(tags, 'DC.title'));
      const hasAbstract = Boolean(meta(tags, 'DC.description') ?? sectionText(html, 'abstract', 20_000));
      const hasEvidenceSections = sectionText(html, 'description', 2_000).length >= 200
        || sectionText(html, 'claims', 2_000).length >= 200;
      if (hasBibliography && hasAbstract && hasEvidenceSections) return { html, status: response.status };
    } else if (response.status === 404) {
      return { html: '', status: 404 };
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return { html: bestHtml, status: lastStatus };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function locate(text: string, term: string) {
  const normalizedTerm = term.trim().replace(/[-–—/]+/g, ' ').replace(/\s+/g, ' ');
  if (normalizedTerm.length < 3) return -1;
  const flexible = escapeRegExp(normalizedTerm).replace(/ /g, '[\\s\\-–—/]+');
  const searchable = text.replace(/[™®©]/g, ' ');
  return searchable.search(new RegExp(`(?:^|[^a-z0-9])${flexible}(?=$|[^a-z0-9])`, 'i'));
}

function evidenceAt(text: string, index: number, termLength: number) {
  const start = Math.max(0, index - 95);
  const end = Math.min(text.length, index + termLength + 135);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`.slice(0, 360);
}

function bestMatch(primary: string, secondary: string, terms: string[]): TextMatch | null {
  for (const term of [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length)) {
    const primaryIndex = locate(primary, term);
    if (primaryIndex >= 0) return { evidence: evidenceAt(primary, primaryIndex, term.length), confidence: 0.96 };
    const secondaryIndex = locate(secondary, term);
    if (secondaryIndex >= 0) return { evidence: evidenceAt(secondary, secondaryIndex, term.length), confidence: 0.82 };
  }
  return null;
}

function contextualDescriptionMatch(text: string, terms: string[]): TextMatch | null {
  for (const term of [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length)) {
    let offset = 0;
    for (let occurrence = 0; occurrence < 30 && offset < text.length; occurrence += 1) {
      const relativeIndex = locate(text.slice(offset), term);
      if (relativeIndex < 0) break;
      const index = offset + relativeIndex;
      const evidence = evidenceAt(text, index, term.length);
      if (/(?:present (?:disclosure|invention)|\bexample\b|composition (?:was|is)|used as|coated? (?:on|with))/i.test(evidence)) return { evidence, confidence: 0.82 };
      offset = index + Math.max(term.length, 1);
    }
  }
  return null;
}

function catalogSuggestions(items: Named[], termsByName: Record<string, string[]>, primaryText: string, secondaryText = '') {
  return items.flatMap((item) => {
    const terms = termsByName[item.name.toLowerCase()] ?? [item.name];
    const match = bestMatch(primaryText, '', terms) ?? contextualDescriptionMatch(secondaryText, terms);
    return match ? [{ id: item.id, name: item.name, confidence: match.confidence, evidence: match.evidence }] : [];
  });
}

function roleForChemical(chemical: Chemical, evidence: string, roles: Named[]) {
  const roleByName = new Map(roles.map((role) => [role.name.toLowerCase(), role]));
  const chemicalClass = chemical.chemical_class?.toLowerCase() ?? '';
  // A catalogued material's chemical class is stronger evidence than generic
  // role words that may merely occur nearby in a formulation paragraph.
  if (chemicalClass.includes('diglycidyl ether') || chemicalClass.includes('monofunctional glycidyl ether')) return roleByName.get('reactive diluent') ?? null;
  if (chemicalClass.includes('epoxy')) return roleByName.get('epoxy resin') ?? null;
  if (chemicalClass.includes('imidazole') || chemicalClass.includes('accelerator')) return roleByName.get('accelerator') ?? null;
  if (chemicalClass.includes('catalyst')) return roleByName.get('catalyst') ?? null;
  if (chemicalClass.includes('amine') || chemicalClass.includes('anhydride') || chemicalClass.includes('thiol') || chemicalClass.includes('guanidine hardener')) return roleByName.get('hardener') ?? null;
  if (chemicalClass.includes('blowing agent')) return roleByName.get('blowing agent') ?? null;
  for (const [roleName, terms] of Object.entries(ROLE_TERMS)) {
    if (bestMatch(evidence, '', terms)) return roleByName.get(roleName) ?? null;
  }
  return null;
}

async function buildSuggestions(client: ReturnType<typeof createClient>, title: string, abstract: string, html: string) {
  const claims = sectionText(html, 'claims', 450_000);
  const description = sectionText(html, 'description', 1_400_000);
  const primaryText = `${title}. ${abstract}. ${claims}`;
  const [categoryResult, purposeResult, chemicalResult, roleResult, productResult, productMapResult] = await Promise.all([
    client.from('application_categories').select('id,name').order('name'),
    client.from('technical_purposes').select('id,name').order('name'),
    client.from('chemicals').select('id,canonical_name,abbreviation,chemical_class,chemical_synonyms(synonym)').order('canonical_name'),
    client.from('chemical_roles').select('id,name').order('name'),
    client.from('commercial_products').select('id,trade_name,description,product_type'),
    client.from('commercial_product_chemicals').select('commercial_product_id,chemical_id'),
  ]);
  const categories = (categoryResult.data ?? []) as Named[];
  const purposes = (purposeResult.data ?? []) as Named[];
  const chemicals = (chemicalResult.data ?? []) as Chemical[];
  const roles = (roleResult.data ?? []) as Named[];
  const products = (productResult.data ?? []) as CommercialProduct[];
  const chemicalsById = new Map(chemicals.map((chemical) => [chemical.id, chemical]));
  const chemicalIdsByProduct = new Map<string, string[]>();
  for (const mapping of productMapResult.data ?? []) {
    chemicalIdsByProduct.set(mapping.commercial_product_id, [...(chemicalIdsByProduct.get(mapping.commercial_product_id) ?? []), mapping.chemical_id]);
  }

  const categoryMatches = catalogSuggestions(categories, CATEGORY_TERMS, primaryText, description);
  const purposeMatches = catalogSuggestions(purposes, PURPOSE_TERMS, primaryText);
  const chemicalMatches = chemicals.flatMap((chemical) => {
    const terms = [
      chemical.canonical_name,
      chemical.abbreviation ?? '',
      ...(chemical.chemical_synonyms ?? []).map((item) => item.synonym),
    ];
    const match = bestMatch(primaryText, description, terms);
    if (!match) return [];
    const role = roleForChemical(chemical, match.evidence, roles);
    return [{
      chemical_id: chemical.id,
      chemical_name: chemical.abbreviation || chemical.canonical_name,
      role_id: role?.id ?? null,
      role_name: role?.name ?? null,
      confidence: match.confidence,
      evidence: match.evidence,
    }];
  });
  const productMatches = products.flatMap((product) => {
    const match = bestMatch(primaryText, description, [product.trade_name]);
    if (!match) return [];
    const mappedChemicals = (chemicalIdsByProduct.get(product.id) ?? []).flatMap((chemicalId) => {
      const chemical = chemicalsById.get(chemicalId);
      return chemical ? [chemical] : [];
    });
    const role = mappedChemicals.map((chemical) => roleForChemical(chemical, match.evidence, roles)).find(Boolean) ?? null;
    return [{
      commercial_product_id: product.id,
      trade_name: product.trade_name,
      product_type: product.product_type,
      mapped_chemical_ids: mappedChemicals.map((chemical) => chemical.id),
      role_id: role?.id ?? null,
      role_name: role?.name ?? null,
      confidence: match.confidence,
      evidence: match.evidence,
    }];
  });

  return {
    category_ids: categoryMatches.map((item) => item.id),
    purpose_ids: purposeMatches.map((item) => item.id),
    chemicals: chemicalMatches,
    commercial_products: productMatches,
    details: { categories: categoryMatches, purposes: purposeMatches },
  };
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
    const page = await fetchPatentPage(sourceUrl, controller.signal);
    if (!page.html) {
      if (page.status === 404) return json({ error: 'Patent kaynağında eşleşme bulunamadı.', code: 'PATENT_NOT_FOUND' }, 404);
      return json({ error: 'Patent kaynağı geçici olarak yanıt vermedi; alanları manuel doldurabilirsiniz.', code: 'LOOKUP_UNAVAILABLE' }, 503);
    }
    const html = page.html;
    const tags = metaTags(html);
    const title = meta(tags, 'DC.title');
    if (!title) return json({ error: 'Patent bilgileri doğrulanamadı.', code: 'METADATA_NOT_FOUND' }, 404);
    const abstract = meta(tags, 'DC.description') ?? sectionText(html, 'abstract', 20_000);
    const titleNumber = decodeHtml(html.match(/<title>\s*([A-Z]{2}\d+[A-Z]\d?)/i)?.[1] ?? requested).toUpperCase();
    const result = {
      title,
      patent_number: titleNumber,
      country_code: numberMatch[1],
      publication_date: publicationDate(tags),
      assignee: meta(tags, 'DC.contributor', 'assignee'),
      abstract,
      source_url: sourceUrl,
    };
    const suggestions = await buildSuggestions(client, title, abstract, html);
    return json({ metadata: result, suggestions });
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
