import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

import { chromium } from 'playwright-core';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://patentory.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export class BridgeError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.status = status;
  }
}

export function allowedOrigins(environment = process.env) {
  const configured = String(environment.PATENTORY_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

export function isAllowedOrigin(origin, environment = process.env) {
  if (!origin) return true;
  if (allowedOrigins(environment).has(origin)) return true;
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function corsHeaders(origin, environment = process.env) {
  const headers = {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin, Access-Control-Request-Private-Network',
  };
  if (origin && isAllowedOrigin(origin, environment)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function validatePdfUrl(value, environment = process.env) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BridgeError('INVALID_REQUEST', 'PDF bağlantısı geçersiz.', 400);
  }
  const localTestHost = environment.NODE_ENV === 'test'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const supabaseHost = url.protocol === 'https:' && (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in'));
  const signedPatentPath = url.pathname.includes('/storage/v1/object/sign/patent-pdfs/');
  if (!(localTestHost || (supabaseHost && signedPatentPath && url.searchParams.has('token')))) {
    throw new BridgeError('INVALID_REQUEST', 'Yalnızca imzalı Patentory PDF bağlantıları kabul edilir.', 400);
  }
  return url;
}

export function safePdfName(value) {
  const raw = basename(String(value || 'patent.pdf'));
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const stem = cleaned.toLowerCase().endsWith('.pdf') ? cleaned.slice(0, -4) : cleaned;
  return `${stem || 'patent'}.pdf`;
}

export function extractJsonObject(value) {
  const text = String(value ?? '').trim();
  if (!text) throw new BridgeError('CHATGPT_INVALID_RESULT', 'ChatGPT boş yanıt verdi.', 422);
  const directCandidates = [text, text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')];
  for (const candidate of directCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // The assistant may add a short prefix despite the JSON-only instruction.
    }
  }

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(start, index + 1));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new BridgeError('CHATGPT_INVALID_RESULT', 'ChatGPT yanıtı geçerli JSON içermiyor.', 422);
}

async function downloadPdf(url, filePath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let response;
  try {
    response = await fetch(url, { redirect: 'error', signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    throw new BridgeError('PDF_DOWNLOAD_FAILED', `PDF indirilemedi: ${error instanceof Error ? error.message : 'bağlantı hatası'}`);
  }
  clearTimeout(timer);
  if (!response.ok || !response.body) throw new BridgeError('PDF_DOWNLOAD_FAILED', 'PDF indirilemedi. İmzalı bağlantının süresi dolmuş olabilir.');
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_PDF_BYTES) throw new BridgeError('PDF_TOO_LARGE', 'PDF 50 MB sınırını aşıyor.', 413);

  let received = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_PDF_BYTES) callback(new BridgeError('PDF_TOO_LARGE', 'PDF 50 MB sınırını aşıyor.', 413));
      else callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(filePath, { flags: 'wx' }));
  const info = await stat(filePath);
  if (info.size < 5) throw new BridgeError('PDF_DOWNLOAD_FAILED', 'İndirilen PDF boş.');
  const signature = await readFile(filePath, { encoding: null, flag: 'r' });
  if (signature.subarray(0, 5).toString('ascii') !== '%PDF-') throw new BridgeError('INVALID_PDF', 'İndirilen dosya geçerli bir PDF değil.', 422);
}

function chromeExecutable(environment = process.env) {
  if (environment.PATENTORY_CHROME_PATH) return environment.PATENTORY_CHROME_PATH;
  if (process.platform === 'darwin') return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  return '/usr/bin/google-chrome';
}

function profileDirectory(environment = process.env) {
  return environment.PATENTORY_CHATGPT_PROFILE || join(homedir(), '.patentory', 'chatgpt-profile');
}

let persistentContext;

async function context(environment = process.env) {
  if (persistentContext) return persistentContext;
  const userDataDir = profileDirectory(environment);
  await mkdir(userDataDir, { recursive: true, mode: 0o700 });
  persistentContext = await chromium.launchPersistentContext(userDataDir, {
    executablePath: chromeExecutable(environment),
    headless: false,
    viewport: null,
    args: ['--start-maximized', '--disable-background-timer-throttling'],
  });
  persistentContext.on('close', () => { persistentContext = undefined; });
  return persistentContext;
}

async function waitForComposer(page) {
  const sessionAuthenticated = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return false;
      const session = await response.json();
      return Boolean(session?.user || session?.accessToken);
    } catch {
      return false;
    }
  });
  const profileVisible = await page.locator([
    '[data-testid="profile-button"]',
    'button[aria-label*="Profili"]',
    'button[aria-label*="profile" i]',
  ].join(',')).first().isVisible().catch(() => false);
  if (!sessionAuthenticated && !profileVisible) {
    throw new BridgeError('LOGIN_REQUIRED', 'Açılan Chrome penceresinde ChatGPT hesabınıza giriş yapın.', 401);
  }
  const composer = page.locator('#prompt-textarea, textarea[placeholder*="ChatGPT"], [contenteditable="true"][role="textbox"]').first();
  try {
    await composer.waitFor({ state: 'visible', timeout: 20_000 });
    return composer;
  } catch {
    throw new BridgeError('LOGIN_REQUIRED', 'Açılan Chrome penceresinde ChatGPT hesabınıza giriş yapın.', 401);
  }
}

async function attachPdf(page, pdfPath, pdfName) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();
  if (!count) {
    const attachmentButton = page.getByRole('button', { name: /Dosya|file|ekle|attach/i }).first();
    await attachmentButton.click({ timeout: 10_000 });
    await page.locator('input[type="file"]').first().waitFor({ state: 'attached', timeout: 10_000 });
  }
  await page.locator('input[type="file"]').last().setInputFiles({
    name: pdfName,
    mimeType: 'application/pdf',
    buffer: await readFile(pdfPath),
  });
  await page.waitForTimeout(1_500);
}

async function waitForAssistantJson(page, previousCount, environment = process.env) {
  const assistantMessages = page.locator('[data-message-author-role="assistant"]');
  const timeout = Number(environment.PATENTORY_CHATGPT_TIMEOUT_MS || 15 * 60 * 1000);
  await assistantMessages.nth(previousCount).waitFor({ state: 'attached', timeout });
  const deadline = Date.now() + timeout;
  let lastText = '';
  let stableSince = 0;
  while (Date.now() < deadline) {
    const currentCount = await assistantMessages.count();
    const text = currentCount > previousCount
      ? (await assistantMessages.nth(currentCount - 1).innerText()).trim()
      : '';
    if (text && text === lastText) {
      if (!stableSince) stableSince = Date.now();
      const generating = await page.getByRole('button', { name: /Yanıt üretmeyi durdur|Stop generating/i }).isVisible().catch(() => false);
      if (!generating && Date.now() - stableSince >= 7_000) return extractJsonObject(text);
    } else {
      lastText = text;
      stableSince = 0;
    }
    await page.waitForTimeout(1_500);
  }
  throw new BridgeError('CHATGPT_TIMEOUT', 'ChatGPT yanıtı beklenen sürede tamamlanmadı.', 504);
}

export async function analyzeWithChatGpt({ pdfUrl, pdfName, prompt }, environment = process.env) {
  if (typeof prompt !== 'string' || prompt.length < 100 || prompt.length > 250_000) {
    throw new BridgeError('INVALID_REQUEST', 'Analiz istemi geçersiz.', 400);
  }
  const validatedUrl = validatePdfUrl(pdfUrl, environment);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'patentory-chatgpt-'));
  const safeName = safePdfName(pdfName);
  const pdfPath = join(temporaryDirectory, safeName);
  let chatPage;
  let keepPageOpen = false;
  try {
    await downloadPdf(validatedUrl, pdfPath);
    const browserContext = await context(environment);
    chatPage = await browserContext.newPage();
    await chatPage.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const composer = await waitForComposer(chatPage);
    await attachPdf(chatPage, pdfPath, safeName);
    const assistantMessages = chatPage.locator('[data-message-author-role="assistant"]');
    const previousCount = await assistantMessages.count();
    await composer.fill(prompt);
    const sendButton = chatPage.getByRole('button', { name: /Prompt gönder|Send prompt|Gönder/i }).last();
    await sendButton.waitFor({ state: 'visible', timeout: 15_000 });
    await sendButton.click({ timeout: 120_000 });
    return await waitForAssistantJson(chatPage, previousCount, environment);
  } catch (error) {
    if (error instanceof BridgeError && error.code === 'LOGIN_REQUIRED') keepPageOpen = true;
    if (error instanceof BridgeError) throw error;
    const message = error instanceof Error ? error.message : 'Bilinmeyen tarayıcı hatası';
    throw new BridgeError('CHATGPT_BRIDGE_FAILED', `ChatGPT tarayıcı işlemi tamamlanamadı: ${message}`);
  } finally {
    if (chatPage && !keepPageOpen) await chatPage.close().catch(() => undefined);
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
