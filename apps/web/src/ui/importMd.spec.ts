import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  IMPORT_MD_MAX_BYTES,
  titleFromFilename,
  validateImportFile,
} from './importMd';

describe('titleFromFilename', () => {
  it('strips extension and path', () => {
    assert.equal(titleFromFilename('foo/bar/笔记.MD'), '笔记');
    assert.equal(titleFromFilename('a.markdown'), 'a');
    assert.equal(titleFromFilename('x.txt'), 'x');
  });
});

describe('validateImportFile', () => {
  it('accepts md under size limit', () => {
    const r = validateImportFile({
      name: 'doc.md',
      size: 100,
      type: 'text/markdown',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.title, 'doc');
  });

  it('rejects bad extension', () => {
    const r = validateImportFile({ name: 'a.pdf', size: 10, type: 'application/pdf' });
    assert.equal(r.ok, false);
  });

  it('rejects empty and oversized', () => {
    assert.equal(
      validateImportFile({ name: 'a.md', size: 0, type: 'text/plain' }).ok,
      false,
    );
    assert.equal(
      validateImportFile({
        name: 'a.md',
        size: IMPORT_MD_MAX_BYTES + 1,
        type: 'text/plain',
      }).ok,
      false,
    );
  });
});
