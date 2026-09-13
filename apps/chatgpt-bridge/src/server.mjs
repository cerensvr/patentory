import { createServer } from 'node:http';

import { analyzeWithChatGpt, BridgeError, corsHeaders, isAllowedOrigin } from './lib.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PATENTORY_BRIDGE_PORT || 47831);
let busy = false;

function send(response, status, body, origin) {
  response.writeHead(status, corsHeaders(origin));
  response.end(JSON.stringify(body));
}

async function jsonBody(request) {
  if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    throw new BridgeError('INVALID_REQUEST', 'Content-Type application/json olmalıdır.', 415);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new BridgeError('INVALID_REQUEST', 'İstek çok büyük.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new BridgeError('INVALID_REQUEST', 'Geçersiz JSON isteği.', 400);
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (!isAllowedOrigin(origin)) {
    send(response, 403, { error: 'Bu web sitesi Patentory köprüsünü kullanamaz.', code: 'ORIGIN_DENIED' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(origin));
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    send(response, 200, { ok: true, busy, service: 'patentory-chatgpt-bridge' }, origin);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/analyze') {
    send(response, 404, { error: 'Bulunamadı.', code: 'NOT_FOUND' }, origin);
    return;
  }
  if (busy) {
    send(response, 409, { error: 'Başka bir patent analizi devam ediyor.', code: 'BRIDGE_BUSY' }, origin);
    return;
  }

  busy = true;
  try {
    const body = await jsonBody(request);
    const analysis = await analyzeWithChatGpt(body);
    send(response, 200, { analysis }, origin);
  } catch (error) {
    const bridgeError = error instanceof BridgeError
      ? error
      : new BridgeError('CHATGPT_BRIDGE_FAILED', 'Yerel ChatGPT işlemi tamamlanamadı.');
    console.error(`[${bridgeError.code}] ${bridgeError.message}`);
    send(response, bridgeError.status, { error: bridgeError.message, code: bridgeError.code }, origin);
  } finally {
    busy = false;
  }
});

server.listen(port, host, () => {
  console.log(`Patentory ChatGPT köprüsü http://${host}:${port} adresinde hazır.`);
});
