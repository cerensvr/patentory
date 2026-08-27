import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const envText = readFileSync(`${root}/apps/mobile/.env.local`, 'utf8');
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }),
);

const apiUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const demoEmail = process.env.DEMO_EMAIL ?? 'demo@patentknowledge.app';
const demoPassword = process.env.DEMO_PASSWORD;

assert.ok(apiUrl && publishableKey && serviceKey && demoPassword, 'Required live verification environment is missing.');

async function request(path, { key = publishableKey, token, method = 'GET', body } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      ...(body == null ? {} : { 'content-type': 'application/json' }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();
  let data = null;
  if (responseText) {
    try { data = JSON.parse(responseText); } catch { data = responseText; }
  }
  return { response, data };
}

const login = await request('/auth/v1/token?grant_type=password', {
  method: 'POST', body: { email: demoEmail, password: demoPassword },
});
assert.equal(login.response.status, 200, JSON.stringify(login.data));
const demoToken = login.data.access_token;
const demoId = login.data.user.id;

const patents = await request('/rest/v1/patents?publication_number=eq.US20210355267A1&select=id,pdf_storage_path&limit=1', { token: demoToken });
assert.equal(patents.response.status, 200, JSON.stringify(patents.data));
assert.equal(patents.data.length, 1);
const patentId = patents.data[0].id;
const storagePath = patents.data[0].pdf_storage_path;

const signed = await request('/storage/v1/object/sign/patent-pdfs', {
  method: 'POST', token: demoToken, body: { expiresIn: 60, paths: [storagePath] },
});
assert.equal(signed.response.status, 200, JSON.stringify(signed.data));
const signedPath = signed.data[0]?.signedURL ?? signed.data[0]?.signedUrl;
assert.ok(signedPath, JSON.stringify(signed.data));
const downloaded = await fetch(`${apiUrl}/storage/v1${signedPath}`);
assert.equal(downloaded.status, 200);
const downloadedPdf = Buffer.from(await downloaded.arrayBuffer());
assert.equal(downloadedPdf.subarray(0, 5).toString(), '%PDF-');

const intruderEmail = `patentory-rls-${Date.now()}@example.test`;
const intruderPassword = 'PatentoryTest2026';
let intruderId;
try {
  const created = await request('/auth/v1/admin/users', {
    method: 'POST', key: serviceKey, token: serviceKey,
    body: { email: intruderEmail, password: intruderPassword, email_confirm: true },
  });
  assert.equal(created.response.status, 200, JSON.stringify(created.data));
  intruderId = created.data.id;

  const intruderLogin = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email: intruderEmail, password: intruderPassword },
  });
  assert.equal(intruderLogin.response.status, 200, JSON.stringify(intruderLogin.data));
  const intruderToken = intruderLogin.data.access_token;

  const stolenPatent = await request(`/rest/v1/patents?id=eq.${patentId}&select=id`, { token: intruderToken });
  assert.equal(stolenPatent.response.status, 200, JSON.stringify(stolenPatent.data));
  assert.deepEqual(stolenPatent.data, []);

  const stolenPdf = await request('/storage/v1/object/sign/patent-pdfs', {
    method: 'POST', token: intruderToken, body: { expiresIn: 60, paths: [storagePath] },
  });
  assert.ok(stolenPdf.response.status >= 400 || !stolenPdf.data[0]?.signedURL, JSON.stringify(stolenPdf.data));
} finally {
  if (intruderId) {
    const deleted = await request(`/auth/v1/admin/users/${intruderId}`, {
      method: 'DELETE', key: serviceKey, token: serviceKey,
    });
    assert.equal(deleted.response.status, 200, JSON.stringify(deleted.data));
  }
}

let aiStatus = 'skipped';
let aiDetail = null;
if (process.env.RUN_LIVE_AI === '1') {
  const analyzed = await request('/functions/v1/analyze-patent', {
    method: 'POST', token: demoToken, body: { patentId },
  });
  aiStatus = String(analyzed.response.status);
  aiDetail = analyzed.data?.error?.code ?? analyzed.data?.error ?? analyzed.data?.status ?? 'unknown';
}

console.log(`LIVE_DEMO_VERIFY_PASS user=${demoId} patent=${patentId} pdf_download=${downloadedPdf.length} cross_user=blocked ai_http=${aiStatus} ai_result=${String(aiDetail).replace(/\s+/g, '_').slice(0, 120)}`);
