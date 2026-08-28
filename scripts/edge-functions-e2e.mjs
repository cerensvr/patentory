import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const statusResult = spawnSync('npx', ['supabase', 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' });
assert.equal(statusResult.status, 0, statusResult.stderr);
const local = JSON.parse(statusResult.stdout.slice(statusResult.stdout.indexOf('{')));
const apiUrl = local.API_URL;
const anonKey = local.ANON_KEY;
const serviceKey = local.SERVICE_ROLE_KEY;

const analysis = {
  patent_metadata: { title: 'AI E2E patent', patent_number: 'QA-AI-001', country_code: 'US', publication_date: '2024-01-15', assignee: 'Example Materials', abstract: 'Example abstract.' },
  document_language: 'English',
  executive_summary: 'DGEBA ve IPDA içeren, kimyasal dayanımı ve yapışması yüksek bir epoksi kaplama tarifidir.',
  technical_problem: 'Yüksek yapışma ve kimyasal dayanım sağlayan kaplama ihtiyacı.',
  proposed_solution: 'DGEBA epoksi reçinesinin IPDA sertleştiriciyle kürlenmesi.',
  novelty_points: ['DGEBA ve IPDA kombinasyonu'],
  advantages: ['Yüksek yapışma', 'Kimyasal dayanım'],
  limitations_and_risks: ['Ölçek büyütme verisi bulunmuyor'],
  independent_claims: [{ claim_number: '1', summary: 'DGEBA ve IPDA içeren epoksi kaplama.', evidence_quote: 'comprising DGEBA and IPDA', page: 1 }],
  chemicals: [
    { raw_name: 'DGEBA', canonical_candidate: 'Bisphenol A diglycidyl ether', abbreviation: 'DGEBA', cas_number: null, role: 'Epoxy Resin', purpose: 'Binder', confidence: 0.98, evidence_quote: 'bisphenol A diglycidyl ether (DGEBA)', page: 1 },
    { raw_name: 'IPDA', canonical_candidate: 'Isophorone diamine', abbreviation: 'IPDA', cas_number: null, role: 'Hardener', purpose: 'Curing agent', confidence: 0.99, evidence_quote: 'isophorone diamine (IPDA) as a hardener', page: 1 },
    { raw_name: 'IPDA', canonical_candidate: 'Isophorone diamine', abbreviation: 'IPDA', cas_number: null, role: 'Hardener', purpose: 'Curing agent', confidence: 0.62, evidence_quote: 'duplicate IPDA evidence', page: 1 },
  ],
  commercial_products: [{ trade_name: 'VESTAMIN IPD', manufacturer: 'Evonik', mapped_chemical_candidate: 'Isophorone diamine', product_type: 'PURE_CHEMICAL', role: 'Hardener', purpose: 'Curing agent', confidence: 0.75, evidence_quote: 'VESTAMIN IPD', page: 1 }],
  application_categories: [{ name: 'Coating', confidence: 0.97, evidence_quote: 'epoxy coating composition', page: 1 }, { name: 'Unsupported guess', confidence: 0.4, evidence_quote: 'guess', page: null }],
  technical_purposes: [{ name: 'High Adhesion', confidence: 0.96, evidence_quote: 'provides high adhesion', page: 1 }],
  process_steps: ['DGEBA ve IPDA karıştırılır', '80 °C’de 2 saat kürlenir'],
  performance_metrics: [{ name: 'Cure temperature', value: '80', unit: '°C', context: 'Example 1', page: 1 }],
  examples: [{ example_number: 'Example 1', summary: '100 kısım DGEBA ve 25 kısım IPDA.', chemicals: ['DGEBA', 'IPDA'], conditions: ['80 °C', '2 hours'], outcome: 'Cured coating', page: 1 }],
  warnings: ['Bu çıktı hukuki görüş değildir'],
};

let mockAttempts = 0;
const mockServer = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/responses') { response.writeHead(404).end(); return; }
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    const payload = JSON.parse(body);
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].content[0].type, 'input_file');
    assert.equal(payload.input[0].content[0].detail, 'high');
    assert.equal(payload.text.format.type, 'json_schema');
    assert.ok(payload.text.format.schema.properties.patent_metadata);
    assert.match(payload.safety_identifier, /^patentory_[0-9a-f]{64}$/);
    assert.match(payload.prompt_cache_key, /^patentory_patent-review-tr-v3_[0-9a-f]{24}$/);
    assert.equal(JSON.stringify(payload).includes('@example.test'), false);
    mockAttempts += 1;
    if (mockAttempts === 1) {
      response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' });
      response.end(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'temporary mock limit' } }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'completed', output_text: JSON.stringify(analysis), usage: { input_tokens: 120, output_tokens: 420, total_tokens: 540 } }));
  });
});

await new Promise((resolve, reject) => {
  mockServer.once('error', reject); mockServer.listen(5544, '0.0.0.0', resolve);
});

const functionsProcess = spawn('npx', ['supabase', 'functions', 'serve', '--env-file', 'supabase/functions/.env.test'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Edge Functions did not start')), 30_000);
  const inspect = (chunk) => {
    const text = chunk.toString();
    if (text.includes('Serving functions on')) { clearTimeout(timeout); resolve(); }
    if (/error/i.test(text) && !text.includes('inspector')) { clearTimeout(timeout); reject(new Error(text)); }
  };
  functionsProcess.stdout.on('data', inspect); functionsProcess.stderr.on('data', inspect);
  functionsProcess.once('exit', (code) => reject(new Error(`Edge Functions exited early (${code})`)));
});

async function request(path, { token, method = 'GET', body, contentType = 'application/json', key = anonKey } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      ...(body ? { 'content-type': contentType } : {}),
      ...(path.startsWith('/rest/v1/') && method === 'POST' ? { Prefer: 'return=representation' } : {}),
    },
    body: body == null ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

async function createUser(label) {
  const email = `edge-e2e-${label}-${Date.now()}@example.test`;
  const password = 'Patent1234';
  const created = await request('/auth/v1/admin/users', { method: 'POST', key: serviceKey, token: serviceKey, body: { email, password, email_confirm: true } });
  assert.equal(created.response.status, 200, JSON.stringify(created.data));
  const login = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  return { id: created.data.id, token: login.data.access_token };
}

let owner;
let intruder;
try {
  owner = await createUser('owner'); intruder = await createUser('intruder');
  const lookedUp = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US3684617' } });
  assert.equal(lookedUp.response.status, 200, JSON.stringify(lookedUp.data));
  assert.equal(lookedUp.data.metadata.patent_number, 'US3684617A');
  assert.equal(lookedUp.data.metadata.title, 'Curable epoxy resin/acrylic resin mixtures');
  assert.equal(lookedUp.data.metadata.publication_date, '1972-08-15');
  const applicationLookup = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US20210355267A1' } });
  assert.equal(applicationLookup.response.status, 200, JSON.stringify(applicationLookup.data));
  assert.equal(applicationLookup.data.metadata.publication_date, '2021-11-18');
  const patent = await request('/rest/v1/patents?select=id', { method: 'POST', token: owner.token, body: { owner_user_id: owner.id, title: 'AI E2E patent', patent_number: 'QA-AI-001', country_code: 'US' } });
  assert.equal(patent.response.status, 201, JSON.stringify(patent.data));
  const patentId = patent.data[0].id;
  const path = `${owner.id}/${patentId}/${randomUUID()}.pdf`;
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const upload = await request(`/storage/v1/object/patent-pdfs/${path}`, { method: 'POST', token: owner.token, body: pdf, contentType: 'application/pdf' });
  assert.ok(upload.response.ok, JSON.stringify(upload.data));
  const metadata = await request(`/rest/v1/patents?id=eq.${patentId}`, { method: 'PATCH', token: owner.token, body: { pdf_storage_path: path, pdf_original_filename: 'ai-e2e.pdf', pdf_size_bytes: pdf.length, pdf_mime_type: 'application/pdf' } });
  assert.equal(metadata.response.status, 204, JSON.stringify(metadata.data));

  const analyzed = await request('/functions/v1/analyze-patent', { method: 'POST', token: owner.token, body: { patentId } });
  assert.equal(analyzed.response.status, 200, JSON.stringify(analyzed.data));
  assert.equal(analyzed.data.status, 'REVIEW_REQUIRED');
  assert.equal(analyzed.data.suggestionCount, 5);
  assert.equal(analyzed.data.suppressedCount, 1);
  assert.equal(mockAttempts, 2);
  const suggestions = await request(`/rest/v1/ai_analysis_suggestions?patent_id=eq.${patentId}&select=*`, { token: owner.token });
  assert.equal(suggestions.response.status, 200);
  assert.equal(suggestions.data.length, 5);
  const ipda = suggestions.data.find((item) => item.label === 'IPDA');
  assert.ok(ipda?.matched_chemical_id);
  assert.ok(ipda?.matched_role_id);
  const run = await request(`/rest/v1/ai_analysis_runs?id=eq.${analyzed.data.runId}&select=prompt_version,result_json`, { token: owner.token });
  assert.equal(run.data[0].prompt_version, 'patent-review-tr-v3');
  assert.ok(run.data[0].result_json.warnings.some((warning) => warning.includes('1 düşük güvenli')));

  const forbidden = await request('/functions/v1/review-ai-suggestion', { method: 'POST', token: intruder.token, body: { suggestionId: ipda.id, decision: 'ACCEPTED' } });
  assert.equal(forbidden.response.status, 404);
  const accepted = await request('/functions/v1/review-ai-suggestion', { method: 'POST', token: owner.token, body: { suggestionId: ipda.id, decision: 'ACCEPTED' } });
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.status, 'ACCEPTED');
  const materials = await request(`/rest/v1/patent_chemicals?patent_id=eq.${patentId}&select=chemical_id,user_confirmed,source_type`, { token: owner.token });
  assert.equal(materials.data.length, 1);
  assert.equal(materials.data[0].user_confirmed, true);
  assert.equal(materials.data[0].source_type, 'AI');

  const deletedOwner = await request('/functions/v1/delete-account', { method: 'POST', token: owner.token, body: {} });
  assert.equal(deletedOwner.response.status, 200, JSON.stringify(deletedOwner.data));
  assert.equal(deletedOwner.data.deleted, true);
  owner = null;
  console.log('EDGE_E2E_PASS metadata=US3684617A analysis=REVIEW_REQUIRED suggestions=5 suppressed=1 retry=passed cross_user=blocked accepted=IPDA account_deleted=true');
} finally {
  for (const user of [owner, intruder]) {
    if (user) await request(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
  functionsProcess.kill('SIGTERM'); mockServer.close();
}
