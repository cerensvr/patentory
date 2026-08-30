import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const supabaseCli = process.env.SUPABASE_CLI || 'npx';
const supabaseArgs = process.env.SUPABASE_CLI ? [] : ['supabase'];
const statusResult = spawnSync(supabaseCli, [...supabaseArgs, 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' });
assert.equal(statusResult.status, 0, statusResult.stderr);
const local = JSON.parse(statusResult.stdout.slice(statusResult.stdout.indexOf('{')));
const apiUrl = local.API_URL;
const anonKey = local.ANON_KEY;
const serviceKey = local.SERVICE_ROLE_KEY;

const analysis = {
  patent_metadata: { title: 'AI E2E patent', patent_number: 'QA-AI-001', country_code: 'US', publication_date: '2024-01-15', assignee: 'Example Materials', abstract_tr: 'Örnek abstractın Türkçe çevirisi.' },
  document_language: 'English',
  executive_summary: 'DGEBA ve IPDA içeren, kimyasal dayanımı ve yapışması yüksek bir epoksi kaplama tarifidir.',
  technical_problem: 'Yüksek yapışma ve kimyasal dayanım sağlayan kaplama ihtiyacı.',
  proposed_solution: 'DGEBA epoksi reçinesinin IPDA sertleştiriciyle kürlenmesi.',
  novelty_points: ['DGEBA ve IPDA kombinasyonu'],
  advantages: ['Yüksek yapışma', 'Kimyasal dayanım'],
  limitations_and_risks: ['Ölçek büyütme verisi bulunmuyor'],
  independent_claims: [{ claim_number: '1', summary_tr: 'DGEBA ve IPDA içeren epoksi kaplama.', evidence_quote: 'comprising DGEBA and IPDA', evidence_translation_tr: 'DGEBA ve IPDA içerir', page: 1 }],
  chemicals: [
    { raw_name: 'DGEBA', display_name_tr: 'Bisfenol A diglisidil eter', canonical_candidate: 'Bisphenol A diglycidyl ether', abbreviation: 'DGEBA', cas_number: null, role: 'Epoxy Resin', purpose: 'Binder', confidence: 0.98, evidence_quote: 'bisphenol A diglycidyl ether (DGEBA)', evidence_translation_tr: 'bisfenol A diglisidil eter (DGEBA)', page: 1 },
    { raw_name: 'IPDA', display_name_tr: 'İzoforon diamin', canonical_candidate: 'Isophorone diamine', abbreviation: 'IPDA', cas_number: null, role: 'Hardener', purpose: 'Curing agent', confidence: 0.99, evidence_quote: 'isophorone diamine (IPDA) as a hardener', evidence_translation_tr: 'sertleştirici olarak izoforon diamin (IPDA)', page: 1 },
    { raw_name: 'IPDA', display_name_tr: 'İzoforon diamin', canonical_candidate: 'Isophorone diamine', abbreviation: 'IPDA', cas_number: null, role: 'Hardener', purpose: 'Curing agent', confidence: 0.62, evidence_quote: 'duplicate IPDA evidence', evidence_translation_tr: 'yinelenen IPDA kanıtı', page: 1 },
  ],
  commercial_products: [{ trade_name: 'VESTAMIN IPD', display_name_latin: 'VESTAMIN IPD', manufacturer: 'Evonik', mapped_chemical_candidate: 'Isophorone diamine', product_type: 'PURE_CHEMICAL', role: 'Hardener', purpose: 'Curing agent', confidence: 0.75, evidence_quote: 'VESTAMIN IPD', evidence_translation_tr: 'VESTAMIN IPD', page: 1 }],
  application_categories: [{ name: 'Coating', display_name_tr: 'Kaplama', confidence: 0.97, evidence_quote: 'epoxy coating composition', evidence_translation_tr: 'epoksi kaplama bileşimi', page: 1 }, { name: 'Unsupported guess', display_name_tr: 'Desteksiz tahmin', confidence: 0.4, evidence_quote: 'guess', evidence_translation_tr: 'tahmin', page: null }],
  technical_purposes: [{ name: 'High Adhesion', display_name_tr: 'Yüksek yapışma', confidence: 0.96, evidence_quote: 'provides high adhesion', evidence_translation_tr: 'yüksek yapışma sağlar', page: 1 }],
  process_steps: ['DGEBA ve IPDA karıştırılır', '80 °C’de 2 saat kürlenir'],
  performance_metrics: [{ name_tr: 'Kürlenme sıcaklığı', value: '80', unit: '°C', context_tr: 'Örnek 1', page: 1 }],
  component_standardizations: [
    { source_name: 'DGEBA', standardized_name_tr: 'Bisfenol A diglisidil eter', function_tr: 'Epoksi reçinesi', description_tr: 'Ana bağlayıcı', page: 1 },
    { source_name: 'IPDA', standardized_name_tr: 'İzoforon diamin', function_tr: 'Sertleştirici', description_tr: 'Amin kürleyici', page: 1 },
  ],
  example_inventory: { declared_count: 20, identifiers: Array.from({ length: 20 }, (_, index) => String(index + 1)), source_pages: [1], note_tr: 'Patent tablosunda yirmi deney örneği bulundu.' },
  experimental_tables: [{
    table_type: 'EXAMPLE_COMPOSITION_MATRIX',
    title_tr: 'Örnek bileşimi',
    columns: [
      { label_tr: 'DGEBA', original_label: 'DGEBA', unit: 'phr' },
      { label_tr: 'IPDA', original_label: 'IPDA', unit: 'phr' },
    ],
    rows: Array.from({ length: 20 }, (_, index) => ({ row_label_tr: String(index + 1), cells_tr: ['100', String(25 + index)], page: 1 })),
    note_tr: 'Miktarlar phr cinsindedir.',
  }],
  examples: [{
    example_number: 'Örnek 1',
    summary_tr: '100 kısım DGEBA ve 25 kısım IPDA içeren reçete.',
    chemicals: ['DGEBA', 'IPDA'],
    conditions_tr: ['80 °C', '2 saat'],
    composition: [
      { component: 'DGEBA', component_original: 'DGEBA', component_tr: 'Bisfenol A diglisidil eter', amount: '100', unit: 'phr', unit_original: 'phr', unit_tr: 'phr', basis_tr: 'reçine bazında', role_tr: 'Epoksi reçine', page: 1 },
      { component: 'IPDA', component_original: 'IPDA', component_tr: 'İzoforon diamin', amount: '25', unit: 'phr', unit_original: 'phr', unit_tr: 'phr', basis_tr: 'reçine bazında', role_tr: 'Sertleştirici', page: 1 },
    ],
    production_steps: [
      { step_number: '1', instruction_tr: 'DGEBA ile IPDA karıştırılır.', conditions_tr: ['23 °C'], page: 1 },
      { step_number: '2', instruction_tr: 'Karışım kürlenir.', conditions_tr: ['80 °C', '2 saat'], page: 1 },
    ],
    test_results: [
      { test_name_tr: 'Çekme yapışması', method: 'ASTM D4541', result_tr: '12', unit: 'MPa', specimen_tr: 'Çelik panel', page: 1 },
    ],
    outcome_tr: 'Kürlenmiş kaplama',
    page: 1,
  }],
  warnings: ['Bu çıktı hukuki görüş değildir'],
};

let mockAttempts = 0;
const mockPrompts = [];
const mockServer = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1beta/interactions') { response.writeHead(404).end(); return; }
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    const payload = JSON.parse(body);
    assert.equal(request.headers['x-goog-api-key'], 'test-only-gemini-key');
    assert.equal(payload.store, false);
    assert.equal(payload.input[0].type, 'document');
    assert.equal(payload.input[0].mime_type, 'application/pdf');
    assert.ok(payload.input[0].data.length > 20);
    assert.equal(payload.input[1].type, 'text');
    assert.equal(payload.response_format.type, 'text');
    assert.equal(payload.response_format.mime_type, 'application/json');
    assert.ok(payload.response_format.schema.properties.patent_metadata);
    assert.ok(payload.response_format.schema.properties.examples.items.properties.composition);
    assert.ok(payload.response_format.schema.properties.examples.items.properties.production_steps);
    assert.ok(payload.response_format.schema.properties.examples.items.properties.test_results);
    assert.ok(payload.response_format.schema.properties.example_inventory);
    assert.ok(payload.response_format.schema.properties.experimental_tables);
    assert.ok(payload.response_format.schema.properties.component_standardizations);
    assert.ok(payload.response_format.schema.properties.patent_metadata.properties.abstract_tr);
    assert.ok(payload.response_format.schema.properties.examples.items.properties.summary_tr);
    assert.ok(payload.response_format.schema.properties.examples.items.properties.test_results.items.properties.test_name_tr);
    assert.equal(payload.generation_config.max_output_tokens, 18000);
    assert.equal(JSON.stringify(payload).includes('@example.test'), false);
    mockPrompts.push(payload.input[1].text);
    mockAttempts += 1;
    if (mockAttempts === 1) {
      response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0' });
      assert.equal(payload.model, 'gemini-3.7-flash');
      response.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'temporary mock quota' } }));
      return;
    }
    if (mockAttempts === 2) assert.equal(payload.model, 'gemini-3.5-flash-lite');
    if (mockAttempts > 2) assert.equal(payload.model, 'gemini-3.7-flash');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      status: 'completed',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(analysis) }] }],
      usage: { total_input_tokens: 120, total_output_tokens: 420, total_tokens: 540 },
    }));
  });
});

await new Promise((resolve, reject) => {
  mockServer.once('error', reject); mockServer.listen(5544, '0.0.0.0', resolve);
});

const functionsProcess = spawn(supabaseCli, [...supabaseArgs, 'functions', 'serve', '--env-file', 'supabase/functions/.env.test'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Edge Functions did not start')), 30_000);
  const inspect = (chunk) => {
    const text = chunk.toString();
    if (text.includes('AI_LEARNING_FEEDBACK_WRITE_FAILED')) process.stderr.write(text);
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
  let lookedUp = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US3684617' } });
  if (lookedUp.response.ok && !lookedUp.data.suggestions?.category_ids?.includes('20000000-0000-4000-8000-000000000002')) {
    // Google Patents occasionally returns an incomplete edge-cached HTML page;
    // exercise the full endpoint once more before failing the integration test.
    lookedUp = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US3684617' } });
  }
  assert.equal(lookedUp.response.status, 200, JSON.stringify(lookedUp.data));
  assert.equal(lookedUp.data.metadata.patent_number, 'US3684617A');
  assert.equal(lookedUp.data.metadata.title, 'Curable epoxy resin/acrylic resin mixtures');
  assert.equal(lookedUp.data.metadata.publication_date, '1972-08-15');
  assert.ok(Array.isArray(lookedUp.data.suggestions.category_ids));
  assert.ok(lookedUp.data.suggestions.category_ids.includes('20000000-0000-4000-8000-000000000002'), 'Coating should be suggested from the abstract');
  assert.ok(lookedUp.data.suggestions.category_ids.includes('20000000-0000-4000-8000-000000000003'), 'Adhesive should be suggested from the abstract');
  assert.ok(Array.isArray(lookedUp.data.suggestions.purpose_ids));
  assert.ok(Array.isArray(lookedUp.data.suggestions.chemicals));
  assert.ok(lookedUp.data.suggestions.details.categories.every((item) => item.evidence && item.confidence >= 0.8));
  const dgebaLookup = lookedUp.data.suggestions.chemicals.find((item) => item.chemical_id === '40000000-0000-4000-8000-000000000002');
  assert.ok(dgebaLookup, 'PubChem synonym should map “diglycidyl ether of bisphenol A” to DGEBA');
  assert.equal(dgebaLookup.role_id, '10000000-0000-4000-8000-000000000001');
  const applicationLookup = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US20210355267A1' } });
  assert.equal(applicationLookup.response.status, 200, JSON.stringify(applicationLookup.data));
  assert.equal(applicationLookup.data.metadata.publication_date, '2021-11-18');
  assert.ok(applicationLookup.data.suggestions && Array.isArray(applicationLookup.data.suggestions.chemicals));
  assert.ok(applicationLookup.data.suggestions.category_ids.includes('20000000-0000-4000-8000-000000000002'), 'Coating example should be suggested without using unrelated background text');
  const applicationIpda = applicationLookup.data.suggestions.chemicals.find((item) => item.chemical_id === '40000000-0000-4000-8000-000000000001');
  assert.equal(applicationIpda?.role_id, '10000000-0000-4000-8000-000000000002', 'IPDA must not inherit the nearby epoxy-resin role');
  const productLookup = await request('/functions/v1/lookup-patent-metadata', { method: 'POST', token: owner.token, body: { patentNumber: 'US6013755A' } });
  assert.equal(productLookup.response.status, 200, JSON.stringify(productLookup.data));
  const vestamin = productLookup.data.suggestions.commercial_products.find((item) => item.commercial_product_id === '60000000-0000-4000-8000-000000000001');
  assert.ok(vestamin, 'VESTAMIN IPD should be returned as a commercial product, not collapsed into a chemical string');
  assert.equal(vestamin.role_id, '10000000-0000-4000-8000-000000000002');
  const patent = await request('/rest/v1/patents?select=id', { method: 'POST', token: owner.token, body: { owner_user_id: owner.id, title: 'AI E2E patent', patent_number: 'QA-AI-001', country_code: 'US', abstract_text: 'Original English abstract.' } });
  assert.equal(patent.response.status, 201, JSON.stringify(patent.data));
  const patentId = patent.data[0].id;
  const path = `${owner.id}/${patentId}/${randomUUID()}.pdf`;
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const upload = await request(`/storage/v1/object/patent-pdfs/${path}`, { method: 'POST', token: owner.token, body: pdf, contentType: 'application/pdf' });
  assert.ok(upload.response.ok, JSON.stringify(upload.data));
  const metadata = await request(`/rest/v1/patents?id=eq.${patentId}`, { method: 'PATCH', token: owner.token, body: { pdf_storage_path: path, pdf_original_filename: 'ai-e2e.pdf', pdf_size_bytes: pdf.length, pdf_mime_type: 'application/pdf' } });
  assert.equal(metadata.response.status, 204, JSON.stringify(metadata.data));

  const analyzed = await request('/functions/v1/analyze-patent', { method: 'POST', token: owner.token, body: { patentId, preferGemini: true, allowGeminiFallback: true, allowOpenAiFallback: false } });
  assert.equal(analyzed.response.status, 200, JSON.stringify(analyzed.data));
  assert.equal(analyzed.data.status, 'REVIEW_REQUIRED');
  assert.equal(analyzed.data.suggestionCount, 5);
  assert.equal(analyzed.data.suppressedCount, 1);
  assert.equal(analyzed.data.provider, 'gemini');
  assert.equal(analyzed.data.model, 'gemini-3.5-flash-lite');
  assert.equal(mockAttempts, 2);
  const translatedPatent = await request(`/rest/v1/patents?id=eq.${patentId}&select=abstract_text,user_summary`, { token: owner.token });
  assert.equal(translatedPatent.data[0].abstract_text, 'Original English abstract.');
  assert.equal(translatedPatent.data[0].user_summary, 'Örnek abstractın Türkçe çevirisi.');
  const suggestions = await request(`/rest/v1/ai_analysis_suggestions?patent_id=eq.${patentId}&select=*`, { token: owner.token });
  assert.equal(suggestions.response.status, 200);
  assert.equal(suggestions.data.length, 5);
  const ipda = suggestions.data.find((item) => item.label === 'IPDA');
  assert.ok(ipda?.matched_chemical_id);
  assert.ok(ipda?.matched_role_id);
  const run = await request(`/rest/v1/ai_analysis_runs?id=eq.${analyzed.data.runId}&select=prompt_version,model,result_json`, { token: owner.token });
  assert.equal(run.data[0].prompt_version, 'patent-review-tr-v8');
  assert.equal(run.data[0].model, 'gemini:gemini-3.5-flash-lite');
  assert.equal(run.data[0].result_json.examples[0].composition[1].component, 'IPDA');
  assert.equal(run.data[0].result_json.examples[0].production_steps[1].conditions[0], '80 °C');
  assert.equal(run.data[0].result_json.examples[0].test_results[0].method, 'ASTM D4541');
  assert.equal(run.data[0].result_json.extraction_audit.expected_count, 20);
  assert.equal(run.data[0].result_json.extraction_audit.captured_count, 20);
  assert.equal(run.data[0].result_json.extraction_audit.complete, true);
  assert.equal(run.data[0].result_json.experimental_tables[0].rows.length, 20);
  assert.ok(run.data[0].result_json.warnings.some((warning) => warning.includes('1 düşük güvenli')));

  const forbidden = await request('/functions/v1/review-ai-suggestion', { method: 'POST', token: intruder.token, body: { suggestionId: ipda.id, decision: 'ACCEPTED' } });
  assert.equal(forbidden.response.status, 404);
  const accepted = await request('/functions/v1/review-ai-suggestion', { method: 'POST', token: owner.token, body: { suggestionId: ipda.id, decision: 'ACCEPTED' } });
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.data));
  assert.equal(accepted.data.status, 'ACCEPTED');
  assert.equal(accepted.data.learningDecision, 'ACCEPTED');
  const materials = await request(`/rest/v1/patent_chemicals?patent_id=eq.${patentId}&select=chemical_id,user_confirmed,source_type`, { token: owner.token });
  assert.equal(materials.data.length, 1);
  assert.equal(materials.data[0].user_confirmed, true);
  assert.equal(materials.data[0].source_type, 'AI');

  const productSuggestion = suggestions.data.find((item) => item.label === 'VESTAMIN IPD');
  assert.ok(productSuggestion, 'Commercial product suggestion must be available for correction learning');
  const corrected = await request('/functions/v1/review-ai-suggestion', { method: 'POST', token: owner.token, body: { suggestionId: productSuggestion.id, decision: 'REJECTED', correction: 'IPDA bazlı ticari sertleştirici' } });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.data));
  assert.equal(corrected.data.learningDecision, 'CORRECTED');
  assert.equal(corrected.data.resolvedLabel, 'IPDA bazlı ticari sertleştirici');
  const feedback = await request('/rest/v1/ai_learning_feedback?select=observed_label,decision,resolved_label&order=observed_label', { token: owner.token });
  assert.equal(feedback.response.status, 200, JSON.stringify(feedback.data));
  assert.equal(feedback.data.length, 2);
  assert.ok(feedback.data.some((item) => item.observed_label === 'IPDA' && item.decision === 'ACCEPTED'));
  assert.ok(feedback.data.some((item) => item.observed_label === 'VESTAMIN IPD' && item.decision === 'CORRECTED' && item.resolved_label === 'IPDA bazlı ticari sertleştirici'));
  const intruderFeedback = await request('/rest/v1/ai_learning_feedback?select=id', { token: intruder.token });
  assert.deepEqual(intruderFeedback.data, []);

  const learnedPatent = await request('/rest/v1/patents?select=id', { method: 'POST', token: owner.token, body: { owner_user_id: owner.id, title: 'Learning E2E patent', patent_number: 'QA-AI-002', country_code: 'EP' } });
  assert.equal(learnedPatent.response.status, 201, JSON.stringify(learnedPatent.data));
  const learnedPatentId = learnedPatent.data[0].id;
  const learnedPath = `${owner.id}/${learnedPatentId}/${randomUUID()}.pdf`;
  const learnedUpload = await request(`/storage/v1/object/patent-pdfs/${learnedPath}`, { method: 'POST', token: owner.token, body: pdf, contentType: 'application/pdf' });
  assert.ok(learnedUpload.response.ok, JSON.stringify(learnedUpload.data));
  const learnedMetadata = await request(`/rest/v1/patents?id=eq.${learnedPatentId}`, { method: 'PATCH', token: owner.token, body: { pdf_storage_path: learnedPath, pdf_original_filename: 'learning-e2e.pdf', pdf_size_bytes: pdf.length, pdf_mime_type: 'application/pdf' } });
  assert.equal(learnedMetadata.response.status, 204, JSON.stringify(learnedMetadata.data));
  const learnedAnalysis = await request('/functions/v1/analyze-patent', { method: 'POST', token: owner.token, body: { patentId: learnedPatentId, preferGemini: true, allowGeminiFallback: true, allowOpenAiFallback: false } });
  assert.equal(learnedAnalysis.response.status, 200, JSON.stringify(learnedAnalysis.data));
  assert.equal(learnedAnalysis.data.model, 'gemini-3.7-flash');
  assert.match(mockPrompts.at(-1), /IPDA bazlı ticari sertleştirici/);
  assert.match(mockPrompts.at(-1), /mevcut kimyasal\/ticari ürün kataloğunu değiştirdiğini varsayma/);

  const deletedOwner = await request('/functions/v1/delete-account', { method: 'POST', token: owner.token, body: {} });
  assert.equal(deletedOwner.response.status, 200, JSON.stringify(deletedOwner.data));
  assert.equal(deletedOwner.data.deleted, true);
  owner = null;
  console.log('EDGE_E2E_PASS metadata=US3684617A gemini_fallback=passed tables=v8 complete_examples=20/20 suggestions=5 suppressed=1 cross_user=blocked learning=accepted+corrected+reused account_deleted=true');
} finally {
  for (const user of [owner, intruder]) {
    if (user) await request(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE', key: serviceKey, token: serviceKey });
  }
  functionsProcess.kill('SIGTERM'); mockServer.close();
}
