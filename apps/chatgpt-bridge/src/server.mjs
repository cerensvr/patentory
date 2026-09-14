import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { analyzeWithChatGpt, BridgeError, corsHeaders, isAllowedOrigin } from './lib.mjs';

function send(response, status, body, origin, environment) {
  response.writeHead(status, corsHeaders(origin, environment));
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

export function createBridgeServer({ analyzer = analyzeWithChatGpt, environment = process.env } = {}) {
  let busy = false;
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, environment)) {
      send(response, 403, { error: 'Bu web sitesi Patentory köprüsünü kullanamaz.', code: 'ORIGIN_DENIED' }, origin, environment);
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders(origin, environment));
      response.end();
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      send(response, 200, { ok: true, busy, service: 'patentory-chatgpt-bridge', platform: process.platform }, origin, environment);
      return;
    }
    if (request.method !== 'POST' || request.url !== '/analyze') {
      send(response, 404, { error: 'Bulunamadı.', code: 'NOT_FOUND' }, origin, environment);
      return;
    }
    if (busy) {
      send(response, 409, { error: 'Başka bir patent analizi devam ediyor.', code: 'BRIDGE_BUSY' }, origin, environment);
      return;
    }

    busy = true;
    try {
      const body = await jsonBody(request);
      const analysis = await analyzer(body, environment);
      send(response, 200, { analysis }, origin, environment);
    } catch (error) {
      const bridgeError = error instanceof BridgeError
        ? error
        : new BridgeError('CHATGPT_BRIDGE_FAILED', 'Yerel ChatGPT işlemi tamamlanamadı.');
      console.error(`[${bridgeError.code}] ${bridgeError.message}`);
      send(response, bridgeError.status, { error: bridgeError.message, code: bridgeError.code }, origin, environment);
    } finally {
      busy = false;
    }
  });
}

export function startBridgeServer({ analyzer, environment = process.env } = {}) {
  const host = '127.0.0.1';
  const port = Number(environment.PATENTORY_BRIDGE_PORT || 47831);
  const server = createBridgeServer({ analyzer, environment });
  return new Promise((resolveServer, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      console.log(`Patentory ChatGPT köprüsü http://${host}:${port} adresinde hazır.`);
      resolveServer(server);
    });
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === entrypoint) await startBridgeServer();
