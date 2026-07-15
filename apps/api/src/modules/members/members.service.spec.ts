import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MembersService } from './members.service';

type Store = {
  members: {
    id: string;
    knowledgeBaseId: string;
    userId: string;
    role: string;
    createdAt: Date;
  }[];
  users: {
    id: string;
    mobileE164: string;
    nickname: string;
    deletedAt: Date | null;
  }[];
  kbs: { id: string; deletedAt: Date | null }[];
  audits: unknown[];
};

function mockPrisma(store: Store) {
  const api = {
    kbMember: {
      findUnique: async ({
        where,
      }: {
        where: {
          knowledgeBaseId_userId?: {
            knowledgeBaseId: string;
            userId: string;
          };
          id?: string;
        };
      }) => {
        if (where.knowledgeBaseId_userId) {
          const m = store.members.find(
            (x) =>
              x.knowledgeBaseId ===
                where.knowledgeBaseId_userId!.knowledgeBaseId &&
              x.userId === where.knowledgeBaseId_userId!.userId,
          );
          if (!m) return null;
          const kb = store.kbs.find((k) => k.id === m.knowledgeBaseId);
          const user = store.users.find((u) => u.id === m.userId)!;
          return {
            ...m,
            kb: { deletedAt: kb?.deletedAt ?? null },
            user: {
              mobileE164: user.mobileE164,
              nickname: user.nickname,
            },
          };
        }
        return null;
      },
      findMany: async ({
        where,
      }: {
        where: { knowledgeBaseId: string };
      }) =>
        store.members
          .filter((m) => m.knowledgeBaseId === where.knowledgeBaseId)
          .map((m) => {
            const user = store.users.find((u) => u.id === m.userId)!;
            return {
              ...m,
              user: {
                mobileE164: user.mobileE164,
                nickname: user.nickname,
              },
            };
          }),
      create: async ({
        data,
      }: {
        data: {
          id: string;
          knowledgeBaseId: string;
          userId: string;
          role: string;
        };
      }) => {
        const row = { ...data, createdAt: new Date() };
        store.members.push(row);
        const user = store.users.find((u) => u.id === data.userId)!;
        return {
          ...row,
          user: { mobileE164: user.mobileE164, nickname: user.nickname },
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: {
          id?: string;
          knowledgeBaseId_userId?: { knowledgeBaseId: string; userId: string };
        };
        data: { role: string };
      }) => {
        let m = where.id
          ? store.members.find((x) => x.id === where.id)
          : store.members.find(
              (x) =>
                x.knowledgeBaseId ===
                  where.knowledgeBaseId_userId!.knowledgeBaseId &&
                x.userId === where.knowledgeBaseId_userId!.userId,
            );
        if (!m) throw new Error('member not found');
        m.role = data.role;
        const user = store.users.find((u) => u.id === m!.userId)!;
        return {
          ...m,
          user: { mobileE164: user.mobileE164, nickname: user.nickname },
        };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = store.members.findIndex((x) => x.id === where.id);
        store.members.splice(i, 1);
        return {};
      },
    },
    user: {
      findFirst: async ({
        where,
      }: {
        where: { mobileE164: string; deletedAt: null };
      }) =>
        store.users.find(
          (u) => u.mobileE164 === where.mobileE164 && !u.deletedAt,
        ) ?? null,
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        store.audits.push(data);
        return data;
      },
    },
  };
  return api;
}

describe('MembersService', () => {
  let store: Store;
  let svc: MembersService;

  beforeEach(() => {
    store = {
      kbs: [{ id: 'kb1', deletedAt: null }],
      users: [
        {
          id: 'u1',
          mobileE164: '+8613800000001',
          nickname: 'Owner',
          deletedAt: null,
        },
        {
          id: 'u2',
          mobileE164: '+8613800000002',
          nickname: 'Bob',
          deletedAt: null,
        },
      ],
      members: [
        {
          id: 'm1',
          knowledgeBaseId: 'kb1',
          userId: 'u1',
          role: 'owner',
          createdAt: new Date(),
        },
      ],
      audits: [],
    };
    svc = new MembersService(mockPrisma(store) as never);
  });

  it('owner adds editor by mobile', async () => {
    const r = await svc.add('u1', 'kb1', {
      mobileE164: '+8613800000002',
      role: 'editor',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.role, 'editor');
    assert.equal(r.data.userId, 'u2');
    assert.equal(store.members.length, 2);
  });

  it('rejects adding owner role', async () => {
    const r = await svc.add('u1', 'kb1', {
      mobileE164: '+8613800000002',
      role: 'owner',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 400);
  });

  it('non-owner cannot add members (404)', async () => {
    store.members.push({
      id: 'm2',
      knowledgeBaseId: 'kb1',
      userId: 'u2',
      role: 'editor',
      createdAt: new Date(),
    });
    const r = await svc.add('u2', 'kb1', {
      mobileE164: '+8613800000001',
      role: 'reader',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });

  it('lists members for any member', async () => {
    store.members.push({
      id: 'm2',
      knowledgeBaseId: 'kb1',
      userId: 'u2',
      role: 'reader',
      createdAt: new Date(),
    });
    const r = await svc.list('u2', 'kb1');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.items.length, 2);
    assert.equal(r.data.items[0].role, 'owner');
  });

  it('cannot remove owner', async () => {
    const r = await svc.remove('u1', 'kb1', 'u1');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 409);
  });

  it('removes editor', async () => {
    store.members.push({
      id: 'm2',
      knowledgeBaseId: 'kb1',
      userId: 'u2',
      role: 'editor',
      createdAt: new Date(),
    });
    const r = await svc.remove('u1', 'kb1', 'u2');
    assert.equal(r.ok, true);
    assert.equal(store.members.length, 1);
  });

  it('updates role for non-owner', async () => {
    store.members.push({
      id: 'm2',
      knowledgeBaseId: 'kb1',
      userId: 'u2',
      role: 'reader',
      createdAt: new Date(),
    });
    const r = await svc.updateRole('u1', 'kb1', 'u2', 'editor');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.role, 'editor');
  });

  it('transfers owner in one step', async () => {
    store.members.push({
      id: 'm2',
      knowledgeBaseId: 'kb1',
      userId: 'u2',
      role: 'editor',
      createdAt: new Date(),
    });
    // extend mock for transaction + knowledgeBase
    const base = mockPrisma(store) as any;
    base.knowledgeBase = {
      update: async ({ data }: { data: { ownerUserId: string } }) => {
        (store as any).ownerUserId = data.ownerUserId;
        return { id: 'kb1', ...data };
      },
    };
    base.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(base);
    svc = new MembersService(base as never);

    const r = await svc.transferOwner('u1', 'kb1', 'u2');
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.role, 'owner');
    assert.equal(r.data.userId, 'u2');
    const u1 = store.members.find((m) => m.userId === 'u1')!;
    const u2 = store.members.find((m) => m.userId === 'u2')!;
    assert.equal(u1.role, 'editor');
    assert.equal(u2.role, 'owner');
    assert.equal((store as any).ownerUserId, 'u2');
  });

  it('rejects transfer to non-member', async () => {
    const r = await svc.transferOwner('u1', 'kb1', 'u2');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });
});
