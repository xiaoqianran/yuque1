import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DUPLICATE_TITLE_MAX,
  DUPLICATE_TITLE_SUFFIX,
  duplicateTitle,
} from './duplicateDoc';

describe('duplicateTitle', () => {
  it('appends Chinese copy suffix', () => {
    assert.equal(duplicateTitle('验收文档'), `验收文档${DUPLICATE_TITLE_SUFFIX}`);
  });

  it('uses fallback for blank title', () => {
    assert.equal(duplicateTitle('   '), `无标题文档${DUPLICATE_TITLE_SUFFIX}`);
  });

  it('truncates long titles to max length', () => {
    const long = '字'.repeat(600);
    const t = duplicateTitle(long);
    assert.equal(t.length, DUPLICATE_TITLE_MAX);
    assert.ok(t.endsWith(DUPLICATE_TITLE_SUFFIX));
  });
});
