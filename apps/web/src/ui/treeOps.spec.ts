import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicNode } from '../api/types';
import {
  adjacentVisibleNode,
  buildBreadcrumbPath,
  buildChildrenMap,
  buildMoveParentOptions,
  collectAncestorIds,
  collectParentIdsWithChildren,
  expandAncestorsInCollapsed,
  flattenVisibleTree,
  normalizeKbDescription,
  normalizeKbName,
  normalizeRenameTitle,
  normalizeSearchQuery,
  pickDefaultDocument,
  planSiblingReorder,
  resolveCreateParentId,
  siblingReorderAvailability,
  toggleCollapsedId,
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

describe('normalizeKbName', () => {
  it('trims valid names', () => {
    const r = normalizeKbName('  工程库 ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.name, '工程库');
  });

  it('rejects empty and overlong', () => {
    assert.equal(normalizeKbName('').ok, false);
    assert.equal(normalizeKbName('x'.repeat(129)).ok, false);
  });
});

describe('normalizeKbDescription', () => {
  it('maps blank to null', () => {
    const r = normalizeKbDescription('   ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.description, null);
  });

  it('rejects over 2000', () => {
    assert.equal(normalizeKbDescription('y'.repeat(2001)).ok, false);
  });
});

describe('planSiblingReorder', () => {
  const siblings = [
    node({ id: 'a', title: 'A', type: 'doc', parentId: null, sortOrder: 1000 }),
    node({ id: 'b', title: 'B', type: 'doc', parentId: null, sortOrder: 2000 }),
    node({ id: 'c', title: 'C', type: 'doc', parentId: null, sortOrder: 3000 }),
    node({ id: 'child', title: 'X', type: 'doc', parentId: 'a', sortOrder: 1000 }),
  ];

  it('swaps with previous on up', () => {
    const r = planSiblingReorder(siblings, 'b', 'up');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.moves[0].id, 'b');
    assert.equal(r.moves[0].sortOrder, 1000);
    assert.equal(r.moves[1].id, 'a');
    assert.equal(r.moves[1].sortOrder, 2000);
  });

  it('swaps with next on down', () => {
    const r = planSiblingReorder(siblings, 'b', 'down');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.moves[0].id, 'b');
    assert.equal(r.moves[0].sortOrder, 3000);
    assert.equal(r.moves[1].id, 'c');
    assert.equal(r.moves[1].sortOrder, 2000);
  });

  it('blocks already first/last and lone sibling', () => {
    assert.equal(planSiblingReorder(siblings, 'a', 'up').ok, false);
    assert.equal(planSiblingReorder(siblings, 'c', 'down').ok, false);
    assert.equal(planSiblingReorder(siblings, 'child', 'up').ok, false);
  });

  it('siblingReorderAvailability', () => {
    assert.deepEqual(siblingReorderAvailability(siblings, 'a'), {
      canUp: false,
      canDown: true,
    });
    assert.deepEqual(siblingReorderAvailability(siblings, 'b'), {
      canUp: true,
      canDown: true,
    });
  });
});

describe('tree collapse helpers', () => {
  const nodes = [
    node({ id: 'root', title: 'R', type: 'folder', parentId: null }),
    node({ id: 'mid', title: 'M', type: 'folder', parentId: 'root' }),
    node({ id: 'leaf', title: 'L', type: 'doc', parentId: 'mid' }),
  ];

  it('collectAncestorIds root to parent', () => {
    assert.deepEqual(collectAncestorIds(nodes, 'leaf'), ['root', 'mid']);
    assert.deepEqual(collectAncestorIds(nodes, 'root'), []);
  });

  it('expandAncestorsInCollapsed opens path', () => {
    const collapsed = new Set(['root', 'mid', 'other']);
    const next = expandAncestorsInCollapsed(
      collapsed,
      collectAncestorIds(nodes, 'leaf'),
    );
    assert.equal(next.has('root'), false);
    assert.equal(next.has('mid'), false);
    assert.equal(next.has('other'), true);
  });

  it('toggleCollapsedId', () => {
    const a = toggleCollapsedId(new Set(), 'x');
    assert.equal(a.has('x'), true);
    const b = toggleCollapsedId(a, 'x');
    assert.equal(b.has('x'), false);
  });

  it('collectParentIdsWithChildren', () => {
    const ids = collectParentIdsWithChildren(nodes);
    assert.equal(ids.includes('root'), true);
    assert.equal(ids.includes('mid'), true);
    assert.equal(ids.includes('leaf'), false);
  });
});

describe('resolveCreateParentId', () => {
  it('creates inside selected folder', () => {
    assert.equal(
      resolveCreateParentId({ id: 'f1', type: 'folder', parentId: null }),
      'f1',
    );
  });

  it('creates sibling when selected is document', () => {
    assert.equal(
      resolveCreateParentId({ id: 'd1', type: 'doc', parentId: 'f1' }),
      'f1',
    );
    assert.equal(
      resolveCreateParentId({ id: 'd2', type: 'doc', parentId: null }),
      null,
    );
  });

  it('creates at root when nothing selected', () => {
    assert.equal(resolveCreateParentId(null), null);
    assert.equal(resolveCreateParentId(undefined), null);
  });
});

describe('pickDefaultDocument', () => {
  const nodes = [
    node({ id: 'f', title: 'Folder', type: 'folder', parentId: null, sortOrder: 1 }),
    node({ id: 'd1', title: 'First', type: 'doc', parentId: 'f', sortOrder: 1 }),
    node({ id: 'd2', title: 'Second', type: 'doc', parentId: null, sortOrder: 2 }),
  ];

  it('prefers last opened document', () => {
    const picked = pickDefaultDocument(nodes, {
      lastOpenedId: 'd2',
      recentIds: ['d1'],
    });
    assert.equal(picked?.id, 'd2');
  });

  it('falls back to recent then first tree doc', () => {
    assert.equal(
      pickDefaultDocument(nodes, { recentIds: ['d1', 'd2'] })?.id,
      'd1',
    );
    // tree order: f children first → d1 before root d2 when walking DFS from root children
    const first = pickDefaultDocument(nodes, {});
    assert.ok(first);
    assert.equal(first.type, 'doc');
  });

  it('returns null for empty or folder-only tree', () => {
    assert.equal(pickDefaultDocument([], {}), null);
    assert.equal(
      pickDefaultDocument(
        [node({ id: 'f', title: 'F', type: 'folder', parentId: null })],
        {},
      ),
      null,
    );
  });

  it('ignores last opened if no longer a doc', () => {
    assert.equal(
      pickDefaultDocument(nodes, { lastOpenedId: 'f', recentIds: ['d2'] })?.id,
      'd2',
    );
  });
});

describe('buildChildrenMap / buildBreadcrumbPath', () => {
  const nodes = [
    node({ id: 'a', title: 'A', type: 'folder', parentId: null, sortOrder: 2 }),
    node({ id: 'b', title: 'B', type: 'doc', parentId: 'a', sortOrder: 1 }),
    node({ id: 'c', title: 'C', type: 'doc', parentId: null, sortOrder: 1 }),
  ];

  it('sorts siblings', () => {
    const map = buildChildrenMap(nodes);
    assert.deepEqual(
      (map.get(null) ?? []).map((n) => n.id),
      ['c', 'a'],
    );
  });

  it('breadcrumb path', () => {
    assert.deepEqual(
      buildBreadcrumbPath(nodes, 'b').map((n) => n.id),
      ['a', 'b'],
    );
  });
});

describe('flattenVisibleTree / adjacentVisibleNode', () => {
  const nodes = [
    node({ id: 'c', title: 'C', type: 'doc', parentId: null, sortOrder: 1 }),
    node({ id: 'a', title: 'A', type: 'folder', parentId: null, sortOrder: 2 }),
    node({ id: 'b', title: 'B', type: 'doc', parentId: 'a', sortOrder: 1 }),
  ];

  it('includes children when folder expanded', () => {
    assert.deepEqual(
      flattenVisibleTree(nodes, new Set()).map((n) => n.id),
      ['c', 'a', 'b'],
    );
  });

  it('hides children when folder collapsed', () => {
    assert.deepEqual(
      flattenVisibleTree(nodes, new Set(['a'])).map((n) => n.id),
      ['c', 'a'],
    );
  });

  it('moves selection down and up', () => {
    const collapsed = new Set<string>();
    assert.equal(
      adjacentVisibleNode(nodes, collapsed, 'c', 1)?.id,
      'a',
    );
    assert.equal(
      adjacentVisibleNode(nodes, collapsed, 'a', 1)?.id,
      'b',
    );
    assert.equal(
      adjacentVisibleNode(nodes, collapsed, 'b', -1)?.id,
      'a',
    );
    // at end stays
    assert.equal(
      adjacentVisibleNode(nodes, collapsed, 'b', 1)?.id,
      'b',
    );
  });
});
