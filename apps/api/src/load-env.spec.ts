import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile, resolveEnvCandidates } from './load-env';

describe('load-env', () => {
  const prev = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'yuque-env-'));
    // clear keys we may set
    delete process.env.DATABASE_URL;
    delete process.env.YUQUE_TEST_KEY;
  });

  afterEach(() => {
    process.env = { ...prev };
    rmSync(dir, { recursive: true, force: true });
  });

  it('loadEnvFile sets missing keys only', () => {
    const f = join(dir, '.env');
    writeFileSync(f, 'YUQUE_TEST_KEY=from-file\nDATABASE_URL=postgres://x\n');
    process.env.YUQUE_TEST_KEY = 'already';
    assert.equal(loadEnvFile(f), true);
    assert.equal(process.env.YUQUE_TEST_KEY, 'already');
    assert.equal(process.env.DATABASE_URL, 'postgres://x');
  });

  it('loadEnvFile returns false when missing', () => {
    assert.equal(loadEnvFile(join(dir, 'nope.env')), false);
  });

  it('resolveEnvCandidates includes monorepo-style paths', () => {
    const list = resolveEnvCandidates('/repo', '/repo/apps/api/dist');
    assert.ok(list.some((p) => p.includes('.env')));
    assert.ok(list.length >= 3);
  });
});
