import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const envText = readFileSync(`${root}/apps/mobile/.env.local`, 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const apiUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.DEMO_EMAIL ?? 'demo@patentknowledge.app';
const currentPassword = process.env.DEMO_PASSWORD_CURRENT;
const finalPassword = process.env.DEMO_PASSWORD_FINAL ?? currentPassword;
const pdfPath = process.env.DEMO_PDF_PATH ?? '/tmp/US20210355267A1.pdf';

assert.ok(apiUrl && publishableKey, 'Mobile Supabase environment is incomplete.');
assert.ok(currentPassword, 'DEMO_PASSWORD_CURRENT is required.');

async function request(path, { token, method = 'GET', body, contentType = 'application/json', prefer } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token ?? publishableKey}`,
      ...(body == null ? {} : { 'content-type': contentType }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body == null ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try { data = JSON.parse(responseText); } catch { data = responseText; }
  }
  return { response, data };
}

function expect(result, expected, label) {
  assert.equal(result.response.status, expected, `${label}: ${JSON.stringify(result.data)}`);
  return result.data;
}

const login = await request('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: { email, password: currentPassword },
});
const session = expect(login, 200, 'Demo login');
const token = session.access_token;
const userId = session.user.id;

if (finalPassword && finalPassword !== currentPassword) {
  const passwordUpdate = await request('/auth/v1/user', {
    method: 'PUT',
    token,
    body: { password: finalPassword },
  });
  expect(passwordUpdate, 200, 'Demo password update');
}

const existingResult = await request(
  '/rest/v1/patents?publication_number=eq.US20210355267A1&select=id&limit=1',
  { token },
);
const existing = expect(existingResult, 200, 'Patent lookup');

const patentMetadata = {
  owner_user_id: userId,
  patent_number: 'US20210355267A1',
  publication_number: 'US20210355267A1',
  application_number: 'US17/253,554',
  title: 'Furfuryl alcohol-derived bifunctional furan epoxy and method for producing same',
  country_code: 'US',
  publication_date: '2021-11-18',
  priority_date: '2018-06-22',
  filing_date: '2019-05-17',
  assignee: 'Kukdo Chemical Co., Ltd.',
  language: 'en',
  abstract_text: 'A bifunctional furan epoxy derived from furfuryl alcohol and a method for producing it, with coating examples cured using isophorone diamine (IPDA).',
  notes: 'Gerçek internet patentiyle uçtan uca doğrulama. Kaynak: Google Patents; PDF ve manuel sınıflandırmalar demo hesabına yüklenmiştir.',
  user_summary: 'Furfuril alkolden türetilen iki fonksiyonlu furan epoksi reçinesi. Patent örneklerinde reçine IPDA ile kürlenerek kaplama performansı inceleniyor.',
  favorite: true,
  archived: false,
};

let patentId;
if (existing.length) {
  patentId = existing[0].id;
  const updated = await request(`/rest/v1/patents?id=eq.${patentId}`, {
    method: 'PATCH', token, body: patentMetadata,
  });
  expect(updated, 204, 'Patent update');
} else {
  const created = await request('/rest/v1/patents?select=id', {
    method: 'POST', token, body: patentMetadata, prefer: 'return=representation',
  });
  patentId = expect(created, 201, 'Patent create')[0].id;
}

const pdf = readFileSync(pdfPath);
assert.ok(pdf.subarray(0, 5).toString() === '%PDF-', 'Demo file is not a PDF.');
const storagePath = `${userId}/${patentId}/10355267-a1a1-4000-8000-000000000001.pdf`;
const uploaded = await request(`/storage/v1/object/patent-pdfs/${storagePath}`, {
  method: 'POST', token, body: pdf, contentType: 'application/pdf', prefer: undefined,
});
if (uploaded.response.status === 400 && String(uploaded.data?.message).toLowerCase().includes('exist')) {
  const replaced = await fetch(`${apiUrl}/storage/v1/object/patent-pdfs/${storagePath}`, {
    method: 'PUT',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      'content-type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdf,
  });
  assert.ok(replaced.ok, `PDF replace: ${await replaced.text()}`);
} else {
  assert.ok(uploaded.response.ok, `PDF upload: ${JSON.stringify(uploaded.data)}`);
}

const pdfMetadata = await request(`/rest/v1/patents?id=eq.${patentId}`, {
  method: 'PATCH',
  token,
  body: {
    pdf_storage_path: storagePath,
    pdf_original_filename: 'US20210355267A1.pdf',
    pdf_size_bytes: pdf.length,
    pdf_mime_type: 'application/pdf',
  },
});
expect(pdfMetadata, 204, 'PDF metadata');

for (const table of ['patent_chemicals', 'patent_application_categories', 'patent_technical_purposes', 'patent_tags']) {
  const deleted = await request(`/rest/v1/${table}?patent_id=eq.${patentId}`, { method: 'DELETE', token });
  expect(deleted, 204, `${table} cleanup`);
}

const chemical = await request('/rest/v1/patent_chemicals', {
  method: 'POST', token,
  body: {
    patent_id: patentId,
    chemical_id: '40000000-0000-4000-8000-000000000001',
    chemical_role_id: '10000000-0000-4000-8000-000000000002',
    raw_material_name: 'Isophorone diamine (IPDA)',
    source_type: 'MANUAL',
    user_confirmed: true,
    source_page: 5,
    source_section: 'Application Example 1',
    source_quote: 'mixed with isophorone diamine (IPDA) as a curing agent',
  },
});
expect(chemical, 201, 'IPDA classification');

const category = await request('/rest/v1/patent_application_categories', {
  method: 'POST', token,
  body: { patent_id: patentId, category_id: '20000000-0000-4000-8000-000000000002' },
});
expect(category, 201, 'Coating category');

const purposes = await request('/rest/v1/patent_technical_purposes', {
  method: 'POST', token,
  body: [
    { patent_id: patentId, purpose_id: '30000000-0000-4000-8000-000000000008' },
    { patent_id: patentId, purpose_id: '30000000-0000-4000-8000-000000000010' },
  ],
});
expect(purposes, 201, 'Technical purposes');

const tagLookup = await request(`/rest/v1/tags?owner_user_id=eq.${userId}&name=eq.${encodeURIComponent('Gerçek internet patenti')}&select=id&limit=1`, { token });
const tags = expect(tagLookup, 200, 'Tag lookup');
let tagId = tags[0]?.id;
if (!tagId) {
  const tagCreate = await request('/rest/v1/tags?select=id', {
    method: 'POST', token,
    body: { owner_user_id: userId, name: 'Gerçek internet patenti' },
    prefer: 'return=representation',
  });
  tagId = expect(tagCreate, 201, 'Tag create')[0].id;
}
const tagLink = await request('/rest/v1/patent_tags', {
  method: 'POST', token, body: { patent_id: patentId, tag_id: tagId },
});
expect(tagLink, 201, 'Tag link');

const ipdaConcept = await request('/rest/v1/rpc/search_chemical_concepts', {
  method: 'POST', token, body: { p_query: 'IPDA', p_limit: 10 },
});
const ipdaMatches = expect(ipdaConcept, 200, 'IPDA concept search');
assert.equal(ipdaMatches[0]?.chemical_id, '40000000-0000-4000-8000-000000000001');

const filtered = await request('/rest/v1/rpc/search_patents', {
  method: 'POST', token,
  body: {
    p_query: null,
    p_chemical_ids: ['40000000-0000-4000-8000-000000000001'],
    p_archived: false,
    p_limit: 20,
  },
});
const filteredPatents = expect(filtered, 200, 'IPDA patent filter');
assert.ok(filteredPatents.some((patent) => patent.id === patentId), 'IPDA filter did not return the demo patent.');

const textSearch = await request('/rest/v1/rpc/search_patents', {
  method: 'POST', token,
  body: { p_query: 'furfuryl', p_archived: false, p_limit: 20 },
});
const textPatents = expect(textSearch, 200, 'Patent text search');
assert.ok(textPatents.some((patent) => patent.id === patentId), 'Text search did not return the demo patent.');

const signed = await request('/storage/v1/object/sign/patent-pdfs', {
  method: 'POST', token, body: { expiresIn: 60, paths: [storagePath] },
});
expect(signed, 200, 'Private PDF signed URL');

console.log(`DEMO_SEED_PASS user=${userId} patent=${patentId} pdf_bytes=${pdf.length} ipda_filter=true text_search=true signed_url=true`);
