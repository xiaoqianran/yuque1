import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  isIgnoredZipPath,
  normalizeZipPath,
  parseMarkdownZip,
  planZipImport,
  validateImportZipFile,
} from './importKbZip';

describe('normalizeZipPath / ignore', () => {
  it('normalizes separators', () => {
    assert.equal(normalizeZipPath('\\foo\\bar.md'), 'foo/bar.md');
  });

  it('ignores mac junk and empty marker', () => {
    assert.equal(isIgnoredZipPath('__MACOSX/._a.md'), true);
    assert.equal(isIgnoredZipPath('.yuque1-export-empty'), true);
    assert.equal(isIgnoredZipPath('docs/a.md'), false);
  });
});

describe('planZipImport', () => {
  it('creates folder then doc ops for nested path', () => {
    const plan = planZipImport([
      { path: '指南/入门.md', body: '# hi' },
      { path: '根.md', body: 'root' },
    ]);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.folderCount, 1);
    assert.equal(plan.docCount, 2);
    assert.equal(plan.ops[0]?.kind, 'folder');
    if (plan.ops[0]?.kind === 'folder') {
      assert.equal(plan.ops[0].title, '指南');
      assert.equal(plan.ops[0].parentPathKey, null);
    }
    const docs = plan.ops.filter((o) => o.kind === 'doc');
    assert.ok(docs.some((d) => d.kind === 'doc' && d.title === '入门' && d.parentPathKey === '指南'));
    assert.ok(docs.some((d) => d.kind === 'doc' && d.title === '根' && d.parentPathKey === null));
  });

  it('rejects empty file list', () => {
    const plan = planZipImport([]);
    assert.equal(plan.ok, false);
  });
});

describe('parseMarkdownZip', () => {
  it('extracts md entries from zip bytes', () => {
    const bytes = zipSync({
      'a.md': strToU8('# A'),
      'dir/b.md': strToU8('B'),
      '.yuque1-export-empty': strToU8('skip'),
    });
    const parsed = parseMarkdownZip(bytes);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.files.length, 2);
    assert.ok(parsed.files.some((f) => f.path === 'a.md' && f.body.includes('A')));
  });
});

describe('validateImportZipFile', () => {
  it('accepts zip under size limit', () => {
    assert.equal(validateImportZipFile({ name: 'kb.zip', size: 100 }).ok, true);
  });

  it('rejects non-zip', () => {
    const r = validateImportZipFile({ name: 'a.md', size: 10 });
    assert.equal(r.ok, false);
  });
});
