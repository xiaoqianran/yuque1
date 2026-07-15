/**
 * Browser acceptance for workspace IA refactor (#137).
 * Uses Playwright chromium against local vite + API.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tmp/workspace-ia-screenshots');
mkdirSync(OUT, { recursive: true });

const BASE =
  process.env.WEB_BASE_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:5173/proxy/5173';
const API =
  process.env.API_BASE_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3000';
const MOBILE =
  process.env.SMOKE_MOBILE ||
  `+86139${String(Date.now()).slice(-8)}`;
const CODE = process.env.SMS_MOCK_CODE || '123456';

const viewports = [
  { name: '1536x996', width: 1536, height: 996 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '390x844', width: 390, height: 844 },
];

function log(msg) {
  console.log(`[verify] ${msg}`);
}

async function apiLogin(request) {
  const send = await request.post(`${API}/api/v1/auth/sms/send`, {
    data: { mobileE164: MOBILE },
  });
  if (!send.ok()) {
    throw new Error(`sms send failed ${send.status()} ${await send.text()}`);
  }
  // mock provider stores code after send; brief pause avoids race
  await new Promise((r) => setTimeout(r, 200));
  const res = await request.post(`${API}/api/v1/auth/sms/login`, {
    data: { mobileE164: MOBILE, code: CODE, nickname: 'ia-verify' },
  });
  if (!res.ok()) {
    throw new Error(`login failed ${res.status()} ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`login envelope ${JSON.stringify(json)}`);
  return res;
}

async function ensureKb(request) {
  const list = await request.get(`${API}/api/v1/kbs`);
  const body = await list.json();
  const items = body.data?.items ?? [];
  let kb = items.find((k) => k.name.includes('IA重构验收'));
  if (!kb) {
    const created = await request.post(`${API}/api/v1/kbs`, {
      data: { name: 'IA重构验收库', description: 'workspace IA verify' },
    });
    const c = await created.json();
    kb = c.data;
  }
  const tree = await request.get(`${API}/api/v1/kbs/${kb.id}/tree`);
  const t = await tree.json();
  if (!(t.data?.items ?? []).some((n) => n.type === 'doc')) {
    await request.post(`${API}/api/v1/kbs/${kb.id}/nodes`, {
      data: { type: 'doc', title: '验收文档', parentId: null },
    });
  }
  return kb;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROME ||
      '/config/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext();
  const request = context.request;

  log('login via API');
  await apiLogin(request);
  const kb = await ensureKb(request);
  log(`kb ${kb.id}`);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const results = [];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${BASE}/kbs/${kb.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const hasSidebar = await page.locator('.ws-sidebar').count();
    const hasSettingsForm = await page
      .locator('.kb-meta-edit, textarea[aria-label="知识库简介"]')
      .count();
    const hasMembersInSidebar = await page
      .locator('.ws-sidebar .members-panel')
      .count();
    const hasDocHeader = await page.locator('.ws-doc-header').count();
    const hasTextarea = await page.locator('textarea.editor').count();
    const hasCm = await page.locator('.cm-editor, .ws-cm-wrap').count();
    const hasGrayEmpty =
      (await page.locator('.editor-placeholder').count()) > 0 &&
      (await page.locator('.ws-doc-header, .ws-empty').count()) === 0;

    // toolbar wrap check at desktop
    let toolbarWraps = false;
    if (vp.width >= 1280 && hasDocHeader) {
      const box = await page.locator('.ws-doc-header').boundingBox();
      const right = await page.locator('.ws-doc-header-right').boundingBox();
      if (box && right) {
        toolbarWraps = right.y > box.y + 8;
      }
    }

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      // Ignore sub-pixel / scrollbar noise
      return doc.scrollWidth > doc.clientWidth + 2;
    });

    // 127.0.0.1 overlay probe
    const midElements = await page.evaluate(() => {
      const els = document.elementsFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 3,
      );
      return els.slice(0, 8).map((el) => ({
        tag: el.tagName,
        cls: el.className?.toString?.().slice(0, 80) ?? '',
        title: el.getAttribute?.('title') ?? '',
        aria: el.getAttribute?.('aria-label') ?? '',
        text: (el.textContent ?? '').trim().slice(0, 40),
      }));
    });
    const has127 = midElements.some(
      (e) =>
        e.title.includes('127.0.0.1') ||
        e.text.includes('127.0.0.1') ||
        e.aria.includes('127.0.0.1'),
    );

    const shot = join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const row = {
      viewport: vp.name,
      hasSidebar: hasSidebar > 0,
      settingsInSidebar: hasSettingsForm > 0,
      membersInSidebar: hasMembersInSidebar > 0,
      hasDocHeader: hasDocHeader > 0,
      bareTextarea: hasTextarea > 0,
      codeMirror: hasCm > 0,
      grayEmpty: hasGrayEmpty,
      toolbarWraps,
      overflowX,
      has127Overlay: has127,
      midElements,
      consoleErrors: [...consoleErrors],
      screenshot: shot,
    };
    results.push(row);
    log(
      `${vp.name}: sidebar=${row.hasSidebar} docHeader=${row.hasDocHeader} cm=${row.codeMirror} wrap=${row.toolbarWraps} overflow=${row.overflowX} 127=${row.has127Overlay}`,
    );
    consoleErrors.length = 0;
  }

  // Interaction checks at 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/kbs/${kb.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // open KB more menu → settings should open dialog
  await page.locator('.ws-kb-head button[aria-label="知识库更多操作"]').click();
  await page.getByRole('menuitem', { name: '知识库设置' }).click();
  const settingsOpen = (await page.locator('#ws-kb-settings-title').count()) > 0;
  await page.screenshot({ path: join(OUT, 'settings-dialog.png') });
  await page.locator('.ws-dialog button[aria-label="关闭"]').first().click();

  // members drawer
  await page.locator('.ws-kb-head button[aria-label="知识库更多操作"]').click();
  await page.getByRole('menuitem', { name: '成员管理' }).click();
  const membersOpen = (await page.locator('#ws-members-title').count()) > 0;
  await page.screenshot({ path: join(OUT, 'members-drawer.png') });
  await page.locator('.ws-drawer button[aria-label="关闭"]').first().click();

  // share dialog from doc header
  let shareOpen = false;
  if ((await page.locator('.ws-doc-header').count()) > 0) {
    await page.getByRole('button', { name: '分享' }).click();
    shareOpen = (await page.locator('#ws-share-title').count()) > 0;
    await page.screenshot({ path: join(OUT, 'share-dialog.png') });
    await page.locator('.ws-dialog button[aria-label="关闭"]').first().click();
  }

  // preview mode
  if ((await page.locator('.ws-seg').count()) > 0) {
    await page.locator('.ws-seg button', { hasText: '预览' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'preview-mode.png') });
  }

  writeFileSync(
    join(OUT, 'report.json'),
    JSON.stringify(
      {
        base: BASE,
        kbId: kb.id,
        settingsOpen,
        membersOpen,
        shareOpen,
        viewports: results,
      },
      null,
      2,
    ),
  );

  log(
    `dialogs: settings=${settingsOpen} members=${membersOpen} share=${shareOpen}`,
  );

  const failed = results.filter(
    (r) =>
      r.settingsInSidebar ||
      r.membersInSidebar ||
      r.bareTextarea ||
      r.grayEmpty ||
      r.has127Overlay ||
      (r.viewport.startsWith('1536') || r.viewport.startsWith('1440')
        ? r.toolbarWraps
        : false) ||
      !r.hasSidebar,
  );

  await browser.close();

  if (failed.length) {
    console.error('FAILED viewports:', JSON.stringify(failed, null, 2));
    process.exit(1);
  }
  if (!settingsOpen || !membersOpen) {
    console.error('Dialogs did not open');
    process.exit(1);
  }
  log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
