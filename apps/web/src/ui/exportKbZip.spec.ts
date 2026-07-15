import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicNode } from '../api/types';
import {
  buildDocExportPaths,
  buildMarkdownZip,
  sanitizePathSegment,
} from './exportKbZip';

function node(
  partial: Partial<PublicNode> & Pick<PublicNode, 'id' | 'title' | 'type'>,
): PublicNode {
  return {
    knowledgeBaseId: 'kb1',
    parentId: null,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('sanitizePathSegment', () => {
  it('strips illegal path chars', () => {
    assert.equal(sanitizePathSegment('a/b:c*'), 'a_b_c_');
  });

  it('falls back for empty', () => {
    assert.equal(sanitizePathSegment('  '), 'untitled');
  });
});

describe('buildDocExportPaths', () => {
  it('nests docs under folders', () => {
    const nodes = [
      node({ id: 'f', title: '指南', type: 'folder', sortOrder: 1 }),
      node({ id: 'd1', title: '入门', type: 'doc', parentId: 'f', sortOrder: 1 }),
      node({ id: 'd2', title: '根文档', type: 'doc', sortOrder: 2 }),
    ];
    const paths = buildDocExportPaths(nodes);
    assert.deepEqual(
      paths.map((p) => p.path).sort(),
      ['指南/入门.md', '根文档.md'].sort(),
    );
  });

  it('disambiguates sibling titles', () => {
    const nodes = [
      node({ id: 'a', title: '同名', type: 'doc', sortOrder: 1 }),
      node({ id: 'b', title: '同名', type: 'doc', sortOrder: 2 }),
    ];
    const paths = buildDocExportPaths(nodes);
    assert.deepEqual(
      paths.map((p) => p.path).sort(),
      ['同名.md', '同名 (2).md'].sort(),
    );
  });

  it('skips empty folders', () => {
    const nodes = [
      node({ id: 'f', title: '空夹', type: 'folder', sortOrder: 1 }),
    ];
    assert.deepEqual(buildDocExportPaths(nodes), []);
  });
});

describe('buildMarkdownZip', () => {
  it('produces non-empty zip bytes', () => {
    const zip = buildMarkdownZip([
      { path: 'a.md', body: '# Hello\n' },
      { path: 'dir/b.md', body: 'world' },
    ]);
    assert.ok(zip.byteLength > 20);
    // ZIP local file header magic
    assert.equal(zip[0], 0x50);
    assert.equal(zip[1], 0x4b);
  });

  it('empty export still yields a zip', () => {
    const zip = buildMarkdownZip([]);
    assert.ok(zip.byteLength > 10);
  });
});
