import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRecentIds,
  parseRecentIdsJson,
  pushRecentId,
  recentDocsStorageKey,
} from './recentDocs';

describe('pushRecentId', () => {
  it('prepends and dedupes', () => {
    assert.deepEqual(pushRecentId(['a', 'b'], 'c', 8), ['c', 'a', 'b']);
    assert.deepEqual(pushRecentId(['a', 'b'], 'a', 8), ['a', 'b']);
  });

  it('caps length', () => {
    const ids = pushRecentId(['1', '2', '3'], '0', 3);
    assert.deepEqual(ids, ['0', '1', '2']);
  });

  it('ignores empty id', () => {
    assert.deepEqual(pushRecentId(['a'], '  ', 8), ['a']);
  });
});

describe('filterRecentIds', () => {
  it('keeps only valid', () => {
    assert.deepEqual(
      filterRecentIds(['a', 'b', 'c'], new Set(['a', 'c'])),
      ['a', 'c'],
    );
  });
});

describe('parseRecentIdsJson', () => {
  it('parses array of strings', () => {
    assert.deepEqual(parseRecentIdsJson('["x","y"]'), ['x', 'y']);
    assert.deepEqual(parseRecentIdsJson('null'), []);
    assert.deepEqual(parseRecentIdsJson('{'), []);
    assert.deepEqual(parseRecentIdsJson(null), []);
  });
});

describe('recentDocsStorageKey', () => {
  it('namespaces by kb', () => {
    assert.equal(recentDocsStorageKey('kb1'), 'yuque1:recent-docs:kb1');
  });
});
