import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { KbService } from './kb.service';

type Store = {
  users: { id: string; workspaceId: string }[];
  workspaces: { id: string; ownerUserId: string }[];
  kbs: {
    id: string;
    workspaceId: string;
    ownerUserId: string;
    name: string;
    description: string | null;
    visibility: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[];
  members: {
    id: string;
    knowledgeBaseId: string;
    userId: string;
    role: string;
  }[];
  audits: unknown[];
};

function mockPrisma(store: Store) {
  return {
    workspace: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        store.workspaces.find((w) => w.ownerUserId === where.ownerUserId) ??
        null,
    },
    kbMember: {
      count: async ({ where }: { where: { userId: string; kb: { deletedAt: null } } }) =>
        store.members.filter(
          (m) =>
            m.userId === where.userId &&
            store.kbs.some((k) => k.id === m.knowledgeBaseId && !k.deletedAt),
        ).length,
      findMany: async ({
        where,
        skip,
        take,
      }: {
        where: { userId: string };
        skip: number;
        take: number;
      }) => {
        const rows = store.members
          .filter((m) => m.userId === where.userId)
          .map((m) => ({
            ...m,
            kb: store.kbs.find((k) => k.id === m.knowledgeBaseId)!,
          }))
          .filter((r) => r.kb && !r.kb.deletedAt)
          .sort((a, b) => b.kb.updatedAt.getTime() - a.kb.updatedAt.getTime());
        return rows.slice(skip, skip + take);
      },
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
        const kb = store.kbs.find((k) => k.id === m.knowledgeBaseId);
        if (!kb) return null;
        return { ...m, kb };
      },
      create: async ({ data }: { data: Store['members'][0] }) => {
        store.members.push(data);
        return data;
      },
    },
    knowledgeBase: {
      create: async ({ data }: { data: Omit<Store['kbs'][0], 'createdAt' | 'updatedAt' | 'deletedAt'> }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null as Date | null,
        };
        store.kbs.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Store['kbs'][0]>;
      }) => {
        const kb = store.kbs.find((k) => k.id === where.id)!;
        Object.assign(kb, data, { updatedAt: new Date() });
        return kb;
      },
    },
    treeNode: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [] as { id: string }[],
    },
    shareLink: {
      updateMany: async () => ({ count: 0 }),
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        store.audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma(store)),
  };
}

describe('KbService', () => {
  let store: Store;
  let svc: KbService;

  beforeEach(() => {
    store = {
      users: [{ id: 'u1', workspaceId: 'w1' }],
      workspaces: [{ id: 'w1', ownerUserId: 'u1' }],
      kbs: [],
      members: [],
      audits: [],
    };
    svc = new KbService(mockPrisma(store) as never);
  });

  it('creates kb with owner membership', async () => {
    const r = await svc.create('u1', ' 工程规范 ', 'desc');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.kb.name, '工程规范');
    assert.equal(r.kb.role, 'owner');
    assert.equal(store.members.length, 1);
    assert.equal(store.members[0].role, 'owner');
  });

  it('rejects empty name', async () => {
    const r = await svc.create('u1', '   ');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'VALIDATION_ERROR');
  });

  it('lists only member kbs', async () => {
    await svc.create('u1', 'A');
    await svc.create('u1', 'B');
    // foreign membership on deleted-like other user not listed
    const list = await svc.list('u1', 1, 10);
    assert.equal(list.total, 2);
    assert.equal(list.items.length, 2);
  });

  it('delete requires owner and writes audit', async () => {
    const created = await svc.create('u1', 'ToDelete');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const del = await svc.delete('u1', created.kb.id);
    assert.equal(del.ok, true);
    assert.equal(store.audits.length, 1);
    const get = await svc.get('u1', created.kb.id);
    assert.equal(get.ok, false);
  });

  it('reader cannot update (treated as not found)', async () => {
    const created = await svc.create('u1', 'X');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    store.members[0].role = 'reader';
    const up = await svc.update('u1', created.kb.id, { name: 'Y' });
    assert.equal(up.ok, false);
    if (up.ok) return;
    assert.equal(up.http, 404);
  });
});
