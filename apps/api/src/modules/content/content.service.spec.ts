import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from './content.service';

type Store = {
  members: { knowledgeBaseId: string; userId: string; role: string; kbDeleted: boolean }[];
  nodes: {
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
  }[];
  contents: {
    nodeId: string;
    bodyMd: string;
    contentVersion: number;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  revisions: {
    id: string;
    nodeId: string;
    version: number;
    bodyMd: string;
    reason: string;
    createdBy: string;
    createdAt: Date;
  }[];
  audits: unknown[];
  users: { id: string; nickname: string }[];
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
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          store.nodes.find((n) => {
            if (where.id && n.id !== where.id) return false;
            if (where.knowledgeBaseId && n.knowledgeBaseId !== where.knowledgeBaseId)
              return false;
            if (where.deletedAt === null && n.deletedAt) return false;
            return true;
          }) ?? null
        );
      },
      aggregate: async () => ({ _max: { sortOrder: 0 } }),
      create: async ({ data }: { data: Store['nodes'][0] }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null as Date | null,
        };
        store.nodes.push(row);
        return row;
      },
    },
    documentContent: {
      findUnique: async ({ where }: { where: { nodeId: string } }) =>
        store.contents.find((c) => c.nodeId === where.nodeId) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { nodeId: string } }) => {
        const c = store.contents.find((x) => x.nodeId === where.nodeId);
        if (!c) throw new Error('not found');
        return c;
      },
      findFirst: async ({
        where,
      }: {
        where: { nodeId: string; contentVersion: number };
      }) =>
        store.contents.find(
          (c) =>
            c.nodeId === where.nodeId && c.contentVersion === where.contentVersion,
        ) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { nodeId: string; contentVersion: number };
        data: {
          bodyMd: string;
          contentVersion: { increment: number };
          updatedBy: string;
        };
      }) => {
        const c = store.contents.find(
          (x) =>
            x.nodeId === where.nodeId && x.contentVersion === where.contentVersion,
        );
        if (!c) return { count: 0 };
        c.bodyMd = data.bodyMd;
        c.contentVersion += data.contentVersion.increment;
        c.updatedBy = data.updatedBy;
        c.updatedAt = new Date();
        return { count: 1 };
      },
      create: async ({
        data,
      }: {
        data: {
          nodeId: string;
          bodyMd: string;
          contentVersion: number;
          updatedBy: string;
        };
      }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.contents.push(row);
        return row;
      },
    },
    contentRevision: {
      create: async ({
        data,
      }: {
        data: {
          id: string;
          nodeId: string;
          version: number;
          bodyMd: string;
          reason: string;
          createdBy: string;
        };
      }) => {
        const row = { ...data, createdAt: new Date() };
        store.revisions.push(row);
        return row;
      },
      findMany: async ({
        where,
        take,
      }: {
        where: { nodeId: string };
        orderBy?: unknown;
        take?: number;
        select?: unknown;
      }) => {
        let rows = store.revisions
          .filter((r) => r.nodeId === where.nodeId)
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (take != null) rows = rows.slice(0, take);
        return rows.map((r) => ({
          id: r.id,
          version: r.version,
          reason: r.reason,
          createdBy: r.createdBy,
          createdAt: r.createdAt,
        }));
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; nodeId: string };
      }) =>
        store.revisions.find(
          (r) => r.id === where.id && r.nodeId === where.nodeId,
        ) ?? null,
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        store.audits.push(data);
        return data;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.users.find((u) => u.id === where.id) ?? null,
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] } };
        select?: unknown;
      }) => store.users.filter((u) => where.id.in.includes(u.id)),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(api),
  };
  return api;
}

describe('ContentService', () => {
  let store: Store;
  let svc: ContentService;

  beforeEach(() => {
    store = {
      members: [
        { knowledgeBaseId: 'kb1', userId: 'u1', role: 'owner', kbDeleted: false },
      ],
      nodes: [
        {
          id: 'n1',
          knowledgeBaseId: 'kb1',
          parentId: null,
          type: 'doc',
          title: '原稿',
          sortOrder: 1000,
          createdBy: 'u1',
          updatedBy: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: 'f1',
          knowledgeBaseId: 'kb1',
          parentId: null,
          type: 'folder',
          title: '文件夹',
          sortOrder: 0,
          createdBy: 'u1',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ],
      contents: [
        {
          nodeId: 'n1',
          bodyMd: 'v1 body',
          contentVersion: 1,
          updatedBy: 'u1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      revisions: [],
      audits: [],
      users: [{ id: 'u1', nickname: 'Alice' }],
    };
    svc = new ContentService(mockPrisma(store) as never);
  });

  it('gets doc content', async () => {
    const r = await svc.get('u1', 'n1');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.bodyMd, 'v1 body');
    assert.equal(r.data.version, 1);
    assert.equal(r.data.updatedBy?.nickname, 'Alice');
  });

  it('folder content is not found', async () => {
    const r = await svc.get('u1', 'f1');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });

  it('put increments version with expectedVersion', async () => {
    const r = await svc.put('u1', 'n1', {
      expectedVersion: 1,
      bodyMd: 'v2 body',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.version, 2);
    assert.equal(store.contents[0].bodyMd, 'v2 body');
  });

  it('put conflicts on wrong version', async () => {
    const r = await svc.put('u1', 'n1', {
      expectedVersion: 99,
      bodyMd: 'x',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'DOC_VERSION_CONFLICT');
    assert.equal(r.http, 409);
    assert.equal((r.details as { serverVersion: number }).serverVersion, 1);
  });

  it('overwrite writes revision and audit', async () => {
    const r = await svc.overwrite('u1', 'n1', {
      baseVersion: 1,
      bodyMd: 'forced',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.version, 2);
    assert.equal(store.revisions.length, 1);
    assert.equal(store.audits.length, 1);
    assert.equal(store.contents[0].bodyMd, 'forced');
  });

  it('listRevisions returns overwrite snapshots without body', async () => {
    const ow = await svc.overwrite('u1', 'n1', {
      baseVersion: 1,
      bodyMd: 'forced',
    });
    assert.equal(ow.ok, true);
    const list = await svc.listRevisions('u1', 'n1');
    assert.equal(list.ok, true);
    if (!list.ok) return;
    assert.equal(list.data.items.length, 1);
    assert.equal(list.data.items[0].version, 1);
    assert.equal(list.data.items[0].reason, 'overwrite_on_conflict');
    assert.equal(list.data.items[0].createdBy?.nickname, 'Alice');
    assert.equal(
      'bodyMd' in list.data.items[0],
      false,
    );
  });

  it('getRevision returns pre-overwrite body', async () => {
    await svc.overwrite('u1', 'n1', {
      baseVersion: 1,
      bodyMd: 'forced',
    });
    const list = await svc.listRevisions('u1', 'n1');
    assert.equal(list.ok, true);
    if (!list.ok) return;
    const id = list.data.items[0].id;
    const det = await svc.getRevision('u1', 'n1', id);
    assert.equal(det.ok, true);
    if (!det.ok) return;
    assert.equal(det.data.bodyMd, 'v1 body');
    assert.equal(det.data.nodeId, 'n1');
  });

  it('getRevision wrong id is 404', async () => {
    const det = await svc.getRevision('u1', 'n1', '01HXXXXXXXXXXXXXXXXXXXXXXX');
    assert.equal(det.ok, false);
    if (det.ok) return;
    assert.equal(det.http, 404);
  });

  it('non-member cannot list revisions', async () => {
    store.members = [];
    const list = await svc.listRevisions('u1', 'n1');
    assert.equal(list.ok, false);
    if (list.ok) return;
    assert.equal(list.http, 404);
  });

  it('save-as creates new node without touching source', async () => {
    const r = await svc.saveAs('u1', 'n1', { bodyMd: 'copy body' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.content.version, 1);
    assert.equal(r.data.content.bodyMd, 'copy body');
    assert.match(r.data.node.title, /冲突副本/);
    assert.equal(store.contents.find((c) => c.nodeId === 'n1')?.bodyMd, 'v1 body');
    assert.equal(store.nodes.length, 3);
  });

  it('rejects oversized body (413)', async () => {
    process.env.BODY_MD_MAX_BYTES = '10';
    try {
      const r = await svc.put('u1', 'n1', {
        expectedVersion: 1,
        bodyMd: '01234567890',
      });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.code, 'PAYLOAD_TOO_LARGE');
      assert.equal(r.http, 413);
    } finally {
      delete process.env.BODY_MD_MAX_BYTES;
    }
  });
});
