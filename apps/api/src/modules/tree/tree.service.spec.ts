import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TreeService } from './tree.service';

type NodeRow = {
  id: string;
  knowledgeBaseId: string;
  parentId: string | null;
  type: string;
  title: string;
  sortOrder: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type Store = {
  members: { knowledgeBaseId: string; userId: string; role: string; kbDeleted: boolean }[];
  nodes: NodeRow[];
  contents: { nodeId: string; bodyMd: string; contentVersion: number }[];
  shares: { nodeId: string; enabled: boolean }[];
  audits: unknown[];
};

function mockPrisma(store: Store) {
  const api = {
    kbMember: {
      findUnique: async ({
        where,
      }: {
        where: { knowledgeBaseId_userId: { knowledgeBaseId: string; userId: string } };
      }) => {
        const m = store.members.find(
          (x) =>
            x.knowledgeBaseId === where.knowledgeBaseId_userId.knowledgeBaseId &&
            x.userId === where.knowledgeBaseId_userId.userId,
        );
        if (!m) return null;
        return {
          role: m.role,
          kb: { deletedAt: m.kbDeleted ? new Date() : null },
        };
      },
    },
    treeNode: {
      findMany: async ({
        where,
        take,
      }: {
        where: {
          knowledgeBaseId?: string;
          deletedAt: null;
          title?: { contains: string; mode: string };
        };
        take?: number;
      }) => {
        let rows = store.nodes.filter(
          (n) =>
            !n.deletedAt &&
            (!where.knowledgeBaseId || n.knowledgeBaseId === where.knowledgeBaseId),
        );
        if (where.title?.contains) {
          const q = where.title.contains.toLowerCase();
          rows = rows.filter((n) => n.title.toLowerCase().includes(q));
        }
        rows = rows.sort((a, b) => a.sortOrder - b.sortOrder);
        if (take != null) rows = rows.slice(0, take);
        return rows;
      },
      findFirst: async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: { parentId: true };
      }) => {
        const row = store.nodes.find((n) => {
          if (where.id && n.id !== where.id) return false;
          if (where.knowledgeBaseId && n.knowledgeBaseId !== where.knowledgeBaseId)
            return false;
          if (where.deletedAt === null && n.deletedAt) return false;
          return true;
        });
        if (!row) return null;
        if (select?.parentId) return { parentId: row.parentId };
        return row;
      },
      aggregate: async ({
        where,
      }: {
        where: { knowledgeBaseId: string; parentId: string | null; deletedAt: null };
      }) => {
        const rows = store.nodes.filter(
          (n) =>
            n.knowledgeBaseId === where.knowledgeBaseId &&
            n.parentId === where.parentId &&
            !n.deletedAt,
        );
        const max = rows.reduce((m, n) => Math.max(m, n.sortOrder), 0);
        return { _max: { sortOrder: rows.length ? max : null } };
      },
      count: async ({ where }: { where: { parentId: string; deletedAt: null } }) =>
        store.nodes.filter((n) => n.parentId === where.parentId && !n.deletedAt)
          .length,
      create: async ({ data }: { data: Omit<NodeRow, 'createdAt' | 'updatedAt' | 'deletedAt'> }) => {
        const row: NodeRow = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        };
        store.nodes.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<NodeRow>;
      }) => {
        const n = store.nodes.find((x) => x.id === where.id)!;
        Object.assign(n, data, { updatedAt: new Date() });
        return n;
      },
    },
    documentContent: {
      create: async ({
        data,
      }: {
        data: { nodeId: string; bodyMd: string; contentVersion: number; updatedBy: string };
      }) => {
        store.contents.push({
          nodeId: data.nodeId,
          bodyMd: data.bodyMd,
          contentVersion: data.contentVersion,
        });
        return data;
      },
    },
    shareLink: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { nodeId: string; enabled: boolean };
        data: { enabled: boolean };
      }) => {
        for (const s of store.shares) {
          if (s.nodeId === where.nodeId && s.enabled === where.enabled) {
            s.enabled = data.enabled;
          }
        }
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        store.audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
  };
  return api;
}

describe('TreeService', () => {
  let store: Store;
  let svc: TreeService;

  beforeEach(() => {
    store = {
      members: [{ knowledgeBaseId: 'kb1', userId: 'u1', role: 'owner', kbDeleted: false }],
      nodes: [],
      contents: [],
      shares: [],
      audits: [],
    };
    svc = new TreeService(mockPrisma(store) as never);
  });

  it('creates folder and doc with empty content', async () => {
    const folder = await svc.create('u1', 'kb1', { type: 'folder', title: ' 规范 ' });
    assert.equal(folder.ok, true);
    if (!folder.ok) return;
    assert.equal(folder.data.title, '规范');
    assert.equal(folder.data.type, 'folder');

    const doc = await svc.create('u1', 'kb1', {
      type: 'doc',
      title: 'README',
      parentId: folder.data.id,
    });
    assert.equal(doc.ok, true);
    if (!doc.ok) return;
    assert.equal(store.contents.length, 1);
    assert.equal(store.contents[0].contentVersion, 1);
    assert.equal(doc.data.parentId, folder.data.id);
  });

  it('allows doc as parent (doc subtree)', async () => {
    const parentDoc = await svc.create('u1', 'kb1', { type: 'doc', title: '父文档' });
    assert.equal(parentDoc.ok, true);
    if (!parentDoc.ok) return;
    const child = await svc.create('u1', 'kb1', {
      type: 'doc',
      title: '子文档',
      parentId: parentDoc.data.id,
    });
    assert.equal(child.ok, true);
    if (!child.ok) return;
    assert.equal(child.data.parentId, parentDoc.data.id);
  });

  it('lists tree and searches by title', async () => {
    await svc.create('u1', 'kb1', { type: 'doc', title: 'Alpha' });
    await svc.create('u1', 'kb1', { type: 'doc', title: 'Beta Note' });
    const tree = await svc.getTree('u1', 'kb1');
    assert.equal(tree.ok, true);
    if (!tree.ok) return;
    assert.equal(tree.data.items.length, 2);

    const search = await svc.search('u1', 'kb1', 'beta');
    assert.equal(search.ok, true);
    if (!search.ok) return;
    assert.equal(search.data.items.length, 1);
    assert.equal(search.data.items[0].title, 'Beta Note');
  });

  it('rejects delete when children exist', async () => {
    const parent = await svc.create('u1', 'kb1', { type: 'folder', title: 'P' });
    assert.equal(parent.ok, true);
    if (!parent.ok) return;
    await svc.create('u1', 'kb1', {
      type: 'doc',
      title: 'C',
      parentId: parent.data.id,
    });
    const del = await svc.delete('u1', parent.data.id);
    assert.equal(del.ok, false);
    if (del.ok) return;
    assert.equal(del.code, 'NODE_HAS_CHILDREN');
    assert.equal(del.http, 409);
  });

  it('detects cycle on move', async () => {
    const a = await svc.create('u1', 'kb1', { type: 'folder', title: 'A' });
    assert.equal(a.ok, true);
    if (!a.ok) return;
    const b = await svc.create('u1', 'kb1', {
      type: 'folder',
      title: 'B',
      parentId: a.data.id,
    });
    assert.equal(b.ok, true);
    if (!b.ok) return;
    const moved = await svc.move('u1', a.data.id, { parentId: b.data.id });
    assert.equal(moved.ok, false);
    if (moved.ok) return;
    assert.equal(moved.code, 'NODE_CYCLE_DETECTED');
  });

  it('reader cannot create (404)', async () => {
    store.members[0].role = 'reader';
    const r = await svc.create('u1', 'kb1', { type: 'doc', title: 'X' });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });
});
