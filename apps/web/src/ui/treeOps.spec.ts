import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicNode } from '../api/types';
import {
  buildMoveParentOptions,
  normalizeRenameTitle,
  normalizeSearchQuery,
} from './treeOps';

function node(partial: Partial<PublicNode> & Pick<PublicNode, 'id' | 'title' | 'type'>): PublicNode {
  return {
    knowledgeBaseId: 'kb1',
    parentId: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('normalizeSearchQuery', () => {
  it('accepts trimmed non-empty query', () => {
    const r = normalizeSearchQuery('  规范  ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.q, '规范');
  });

  it('rejects empty', () => {
    const r = normalizeSearchQuery('   ');
    assert.equal(r.ok, false);
  });

  it('rejects over 200 chars', () => {
    const r = normalizeSearchQuery('x'.repeat(201));
    assert.equal(r.ok, false);
  });
});

describe('normalizeRenameTitle', () => {
  it('trims and accepts', () => {
    const r = normalizeRenameTitle('  标题 ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.title, '标题');
  });

  it('rejects empty', () => {
    assert.equal(normalizeRenameTitle('').ok, false);
  });
});

describe('buildMoveParentOptions', () => {
  it('includes root and excludes moving node', () => {
    const nodes = [
      node({ id: 'a', title: 'A', type: 'folder' }),
      node({ id: 'b', title: 'B', type: 'doc' }),
    ];
    const opts = buildMoveParentOptions(nodes, 'a');
    assert.equal(opts[0].value, '');
    assert.equal(opts.some((o) => o.value === 'a'), false);
    assert.equal(opts.some((o) => o.value === 'b'), true);
  });
});
