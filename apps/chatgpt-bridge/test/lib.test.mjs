import assert from 'node:assert/strict';
import test from 'node:test';

import { BridgeError, extractJsonObject, isAllowedOrigin, safePdfName, validatePdfUrl } from '../src/lib.mjs';

test('extractJsonObject accepts direct and fenced JSON', () => {
  assert.deepEqual(extractJsonObject('{"ok":true}'), { ok: true });
  assert.deepEqual(extractJsonObject('```json\n{"summary":"a {brace} and \\\"quote\\\""}\n```'), { summary: 'a {brace} and "quote"' });
});

test('extractJsonObject finds one object after a short prefix', () => {
  assert.deepEqual(extractJsonObject('Sonuç:\n{"nested":{"value":1}}\nBitti.'), { nested: { value: 1 } });
});

test('extractJsonObject rejects non-JSON output', () => {
  assert.throws(() => extractJsonObject('geçersiz'), (error) => error instanceof BridgeError && error.code === 'CHATGPT_INVALID_RESULT');
});

test('origin allowlist accepts Patentory and local development only', () => {
  assert.equal(isAllowedOrigin('https://patentory.vercel.app'), true);
  assert.equal(isAllowedOrigin('http://localhost:4123'), true);
  assert.equal(isAllowedOrigin('https://evil.example'), false);
});

test('signed Supabase patent PDF URLs are required', () => {
  const valid = 'https://project.supabase.co/storage/v1/object/sign/patent-pdfs/user/file.pdf?token=signed';
  assert.equal(validatePdfUrl(valid).href, valid);
  assert.throws(() => validatePdfUrl('https://example.com/file.pdf'), (error) => error instanceof BridgeError && error.code === 'INVALID_REQUEST');
});

test('PDF filenames cannot escape the temporary directory', () => {
  assert.equal(safePdfName('../../çok özel patent.pdf'), 'ok-zel-patent.pdf');
  assert.equal(safePdfName('report'), 'report.pdf');
});
