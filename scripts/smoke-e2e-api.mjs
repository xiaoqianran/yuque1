#!/usr/bin/env node
/**
 * Business-path API smoke (no browser).
 *
 * Flow:
 *   A login → create KB → create doc → put content → enable share → public read
 *   B login → A adds B as editor → B lists KB + reads content
 *   B cannot manage members (404)
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

function createClient() {
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
    return [...cookies.entries()]
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ');
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

  return {
    req,
    clearCookies() {
      cookies.clear();
    },
    hasSid() {
      return cookies.has('sid');
    },
  };
}

function assertOk(step, r, { status } = {}) {
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

async function login(client, mobile, nickname) {
  let r = await client.req(
    'POST',
    '/auth/sms/send',
    { mobileE164: mobile },
    { auth: false },
  );
  assertOk(`sms/send ${nickname}`, r);

  r = await client.req(
    'POST',
    '/auth/sms/login',
    { mobileE164: mobile, code: mockCode, nickname },
    { auth: false },
  );
  assertOk(`sms/login ${nickname}`, r);
  if (!client.hasSid()) {
    throw new Error(`sms/login ${nickname}: missing Set-Cookie sid`);
  }
}

async function main() {
  console.log(`==> smoke-e2e-api base=${base}`);
  const mobileA = uniqueMobile();
  let mobileB = uniqueMobile();
  while (mobileB === mobileA) mobileB = uniqueMobile();

  const kbName = `e2e-kb-${Date.now()}`;
  const docTitle = `e2e-doc-${Date.now()}`;
  const bodyMd = `# hello e2e\n\n${Date.now()}`;

  const a = createClient();
  const b = createClient();
  const anon = createClient();

  // 1) A login
  await login(a, mobileA, 'e2e-owner');
  console.log('    A login ok');

  let r = await a.req('GET', '/auth/me');
  assertOk('A auth/me', r);

  // 2) Create KB
  r = await a.req('POST', '/kbs', { name: kbName, description: 'e2e' });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`kbs create: HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  }
  if (!r.json.success || !r.json.data?.id) {
    throw new Error(`kbs create failed: ${JSON.stringify(r.json)}`);
  }
  const kbId = r.json.data.id;
  console.log(`    kb created id=${kbId}`);

  // 3) Create doc
  r = await a.req('POST', `/kbs/${kbId}/nodes`, {
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

  // 3b) Second sibling + reorder via sortOrder swap
  r = await a.req('POST', `/kbs/${kbId}/nodes`, {
    type: 'doc',
    title: `${docTitle}-b`,
    parentId: null,
  });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`create node b: HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  }
  const nodeIdB = r.json.data?.id;
  if (!nodeIdB) throw new Error(`create node b: no id: ${JSON.stringify(r.json)}`);

  r = await a.req('GET', `/kbs/${kbId}/tree`);
  assertOk('tree list before reorder', r);
  const roots = (r.json.data?.items ?? []).filter((n) => n.parentId == null);
  const aNode = roots.find((n) => n.id === nodeId);
  const bNode = roots.find((n) => n.id === nodeIdB);
  if (!aNode || !bNode) throw new Error('tree missing siblings');
  r = await a.req('POST', `/nodes/${nodeId}/move`, {
    parentId: null,
    sortOrder: bNode.sortOrder,
  });
  assertOk('move A sort', r);
  r = await a.req('POST', `/nodes/${nodeIdB}/move`, {
    parentId: null,
    sortOrder: aNode.sortOrder,
  });
  assertOk('move B sort', r);
  r = await a.req('GET', `/kbs/${kbId}/tree`);
  assertOk('tree list after reorder', r);
  const after = (r.json.data?.items ?? [])
    .filter((n) => n.parentId == null)
    .slice()
    .sort((x, y) => x.sortOrder - y.sortOrder || x.title.localeCompare(y.title));
  if (after[0]?.id !== nodeIdB || after[1]?.id !== nodeId) {
    throw new Error(
      `sibling reorder failed: order=${after.map((n) => `${n.id}:${n.sortOrder}`).join(',')}`,
    );
  }
  console.log('    sibling reorder ok');

  // 4) Put content
  r = await a.req('PUT', `/nodes/${nodeId}/content`, {
    expectedVersion: 1,
    bodyMd,
  });
  assertOk('put content', r);
  if (r.json.data?.version !== 2) {
    throw new Error(`put content: expected version 2, got ${r.json.data?.version}`);
  }
  console.log('    content saved v2');

  // 4b) Overwrite → content_revisions
  const bodyMdAfterOverwrite = `${bodyMd}\n\noverwritten`;
  r = await a.req('POST', `/nodes/${nodeId}/content/overwrite`, {
    baseVersion: 2,
    bodyMd: bodyMdAfterOverwrite,
  });
  assertOk('overwrite content', r);
  if (r.json.data?.version !== 3) {
    throw new Error(`overwrite: expected version 3, got ${r.json.data?.version}`);
  }
  console.log('    content overwritten v3');

  // 4c) List revisions
  r = await a.req('GET', `/nodes/${nodeId}/content/revisions`);
  assertOk('list revisions', r);
  const revItems = r.json.data?.items;
  if (!Array.isArray(revItems) || revItems.length < 1) {
    throw new Error(`list revisions: empty ${JSON.stringify(r.json)}`);
  }
  if (revItems[0].version !== 2 || revItems[0].reason !== 'overwrite_on_conflict') {
    throw new Error(`list revisions: unexpected item ${JSON.stringify(revItems[0])}`);
  }
  const revisionId = revItems[0].id;
  console.log(`    revisions listed n=${revItems.length} id=${revisionId}`);

  // 4d) Get revision detail (pre-overwrite body = body before overwrite)
  r = await a.req('GET', `/nodes/${nodeId}/content/revisions/${revisionId}`);
  assertOk('get revision', r);
  if (r.json.data?.bodyMd !== bodyMd || r.json.data?.version !== 2) {
    throw new Error(`get revision: body mismatch ${JSON.stringify(r.json)}`);
  }
  console.log('    revision detail ok');

  // 5) Enable share with future expiresAt
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  r = await a.req('PUT', `/nodes/${nodeId}/share`, { expiresAt });
  assertOk('share enable', r);
  const token = r.json.data?.token;
  if (!token || !r.json.data?.enabled) {
    throw new Error(`share enable: bad payload ${JSON.stringify(r.json)}`);
  }
  if (!r.json.data?.expiresAt) {
    throw new Error(`share enable: missing expiresAt ${JSON.stringify(r.json)}`);
  }
  console.log(`    share enabled token=${token.slice(0, 8)}… expiresAt=${r.json.data.expiresAt}`);

  // 5b) Past expiresAt → 400
  r = await a.req('PUT', `/nodes/${nodeId}/share`, {
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  if (r.status !== 400 || r.json.success) {
    throw new Error(`share past expiresAt: expected 400, got ${r.status} ${JSON.stringify(r.json)}`);
  }
  console.log('    share past expiresAt rejected');

  // 6) Public read without session (current body after overwrite)
  r = await a.req('GET', `/nodes/${nodeId}/content`);
  assertOk('get content after overwrite', r);
  const currentBody = r.json.data?.bodyMd;
  if (currentBody !== bodyMdAfterOverwrite) {
    throw new Error(
      `content after overwrite mismatch: expected=${JSON.stringify(bodyMdAfterOverwrite)} got=${JSON.stringify(currentBody)}`,
    );
  }
  r = await anon.req('GET', `/share/${token}`, undefined, { auth: false });
  assertOk('share public get', r);
  if (r.json.data?.title !== docTitle || r.json.data?.bodyMd !== currentBody) {
    throw new Error(
      `share public content mismatch: title=${JSON.stringify(r.json.data?.title)} body=${JSON.stringify(r.json.data?.bodyMd)} expectedBody=${JSON.stringify(currentBody)}`,
    );
  }
  console.log('    public share read ok');

  // 7) B registers/login
  await login(b, mobileB, 'e2e-member');
  console.log('    B login ok');

  // 8) A adds B as editor
  r = await a.req('POST', `/kbs/${kbId}/members`, {
    mobileE164: mobileB,
    role: 'editor',
  });
  if (r.status !== 200 && r.status !== 201) {
    throw new Error(`member add: HTTP ${r.status}: ${JSON.stringify(r.json)}`);
  }
  if (!r.json.success || r.json.data?.role !== 'editor') {
    throw new Error(`member add failed: ${JSON.stringify(r.json)}`);
  }
  console.log('    A added B as editor');

  // 9) B lists KBs and sees the kb
  r = await b.req('GET', '/kbs');
  assertOk('B list kbs', r);
  const found = (r.json.data?.items ?? []).some((x) => x.id === kbId);
  if (!found) throw new Error('B list kbs: shared kb missing');
  console.log('    B sees kb in list');

  // 10) B can read content (current after overwrite)
  r = await b.req('GET', `/nodes/${nodeId}/content`);
  assertOk('B get content', r);
  if (r.json.data?.bodyMd !== bodyMdAfterOverwrite) {
    throw new Error(
      `B get content body mismatch: got=${JSON.stringify(r.json.data?.bodyMd)}`,
    );
  }
  console.log('    B can read content');

  // 11) B cannot add members
  r = await b.req('POST', `/kbs/${kbId}/members`, {
    mobileE164: mobileA,
    role: 'reader',
  });
  if (r.status !== 404 || r.json.success) {
    throw new Error(
      `B add member should 404: HTTP ${r.status} ${JSON.stringify(r.json)}`,
    );
  }
  console.log('    B cannot manage members (404)');

  // 12) A lists members (owner + editor)
  r = await a.req('GET', `/kbs/${kbId}/members`);
  assertOk('A list members', r);
  const roles = (r.json.data?.items ?? []).map((m) => m.role).sort();
  if (roles.join(',') !== 'editor,owner') {
    throw new Error(`unexpected members roles: ${roles.join(',')}`);
  }
  console.log('    members list ok (owner+editor)');

  // 13) A transfers owner to B
  const bUserId = r.json.data.items.find((m) => m.role === 'editor')?.userId;
  if (!bUserId) throw new Error('missing editor userId for transfer');
  r = await a.req('POST', `/kbs/${kbId}/transfer-owner`, { userId: bUserId });
  assertOk('transfer owner', r);
  if (r.json.data?.role !== 'owner' || r.json.data?.userId !== bUserId) {
    throw new Error(`transfer owner bad payload: ${JSON.stringify(r.json)}`);
  }
  console.log('    ownership transferred to B');

  // 14) B is owner: can list members; A is editor
  r = await b.req('GET', `/kbs/${kbId}/members`);
  assertOk('B list members as owner', r);
  const after = r.json.data?.items ?? [];
  const aRole = after.find((m) => m.mobileE164 === mobileA)?.role;
  const bRole = after.find((m) => m.mobileE164 === mobileB)?.role;
  if (aRole !== 'editor' || bRole !== 'owner') {
    throw new Error(`post-transfer roles A=${aRole} B=${bRole}`);
  }
  console.log('    post-transfer roles ok');

  // 15) A (now editor) cannot transfer
  r = await a.req('POST', `/kbs/${kbId}/transfer-owner`, { userId: bUserId });
  if (r.status !== 404 || r.json.success) {
    throw new Error(
      `A transfer should 404 after demotion: ${r.status} ${JSON.stringify(r.json)}`,
    );
  }
  console.log('    demoted A cannot transfer (404)');

  console.log('==> BUSINESS E2E SMOKE PASSED');
}

main().catch((e) => {
  console.error('==> BUSINESS E2E SMOKE FAILED');
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
