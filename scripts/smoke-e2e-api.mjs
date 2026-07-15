#!/usr/bin/env node
/**
 * Business-path API smoke (no browser).
 * Flow: SMS login → create KB → create doc → put content → enable share → public read.
 *
 * Usage:
 *   node scripts/smoke-e2e-api.mjs [baseUrl]
 *   SMOKE_BASE_URL=http://127.0.0.1:3020 node scripts/smoke-e2e-api.mjs
 *
 * Env:
 *   SMS_MOCK_CODE (default 123456) — must match API process
 */
import { randomBytes } from 'node:crypto';

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);
const api = `${base}/api/v1`;
const mockCode = process.env.SMS_MOCK_CODE || '123456';

/** @type {Map<string, string>} */
const cookies = new Map();

function applySetCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const single = res.headers.get('set-cookie');
  const list = raw.length ? raw : single ? [single] : [];
  for (const line of list) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    if (i <= 0) continue;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    cookies.set(k, decodeURIComponent(v));
  }
}

function cookieHeader() {
  if (cookies.size === 0) return undefined;
  return [...cookies.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
}

async function req(method, path, body, { auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const c = cookieHeader();
    if (c) headers.Cookie = c;
  }
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  applySetCookie(res);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} → ${res.status} non-JSON: ${text.slice(0, 200)}`);
  }
  return { status: res.status, json };
}

function assertOk(step, r, { status } = {}) {
  // Nest POST often returns 201; GET/PUT/DELETE typically 200
  const allowed = status
    ? [status]
    : r.status === 201
      ? [201]
      : [200, 201];
  if (!allowed.includes(r.status)) {
    throw new Error(
      `${step}: expected HTTP ${allowed.join('|')}, got ${r.status}: ${JSON.stringify(r.json)}`,
    );
  }
  if (!r.json?.success) {
    throw new Error(`${step}: success=false: ${JSON.stringify(r.json)}`);
  }
}

function uniqueMobile() {
  const n = randomBytes(3).readUIntBE(0, 3) % 1_000_000;
  return `+8613800${String(n).padStart(6, '0')}`;
}

async function main() {
  console.log(`==> smoke-e2e-api base=${base}`);
  const mobile = uniqueMobile();
  const kbName = `e2e-kb-${Date.now()}`;
  const docTitle = `e2e-doc-${Date.now()}`;
  const bodyMd = `# hello e2e\n\n${Date.now()}`;

  // 1) SMS send + login
  let r = await req('POST', '/auth/sms/send', { mobileE164: mobile }, { auth: false });
  assertOk('sms/send', r);

  r = await req(
    'POST',
    '/auth/sms/login',
    { mobileE164: mobile, code: mockCode, nickname: 'e2e-bot' },
    { auth: false },
  );
  assertOk('sms/login', r);
  if (!cookies.has('sid')) {
    throw new Error('sms/login: missing Set-Cookie sid');
  }
  console.log('    login ok, sid cookie present');

  r = await req('GET', '/auth/me');
  assertOk('auth/me', r);
  if (r.json.data?.mobileE164 !== mobile) {
    throw new Error(`auth/me mobile mismatch: ${r.json.data?.mobileE164}`);
  }

  // 2) Create KB
  r = await req('POST', '/kbs', { name: kbName, description: 'e2e' });
  // Nest may return 201
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`kbs create: HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  }
  if (!r.json.success || !r.json.data?.id) {
    throw new Error(`kbs create failed: ${JSON.stringify(r.json)}`);
  }
  const kbId = r.json.data.id;
  console.log(`    kb created id=${kbId}`);

  // 3) Create doc
  r = await req('POST', `/kbs/${kbId}/nodes`, {
    type: 'doc',
    title: docTitle,
    parentId: null,
  });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`create node: HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  }
  const nodeId = r.json.data?.id;
  if (!nodeId) throw new Error(`create node: no id: ${JSON.stringify(r.json)}`);
  console.log(`    doc created id=${nodeId}`);

  // 4) Put content (version 1 from create)
  r = await req('PUT', `/nodes/${nodeId}/content`, {
    expectedVersion: 1,
    bodyMd,
  });
  assertOk('put content', r);
  if (r.json.data?.version !== 2) {
    throw new Error(`put content: expected version 2, got ${r.json.data?.version}`);
  }
  console.log('    content saved v2');

  // 5) Enable share
  r = await req('PUT', `/nodes/${nodeId}/share`, {});
  assertOk('share enable', r);
  const token = r.json.data?.token;
  if (!token || !r.json.data?.enabled) {
    throw new Error(`share enable: bad payload ${JSON.stringify(r.json)}`);
  }
  console.log(`    share enabled token=${token.slice(0, 8)}…`);

  // 6) Public read without session
  cookies.clear();
  r = await req('GET', `/share/${token}`, undefined, { auth: false });
  assertOk('share public get', r);
  if (r.json.data?.title !== docTitle) {
    throw new Error(`share title mismatch: ${r.json.data?.title}`);
  }
  if (r.json.data?.bodyMd !== bodyMd) {
    throw new Error(`share bodyMd mismatch`);
  }
  console.log('    public share read ok');

  console.log('==> BUSINESS E2E SMOKE PASSED');
}

main().catch((e) => {
  console.error('==> BUSINESS E2E SMOKE FAILED');
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
