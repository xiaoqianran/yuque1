import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './auth.service';

type Store = {
  users: {
    id: string;
    mobileE164: string;
    nickname: string;
    mobileVerified: boolean;
    email: string | null;
    avatarUrl: string | null;
    deletedAt: Date | null;
  }[];
  audits: unknown[];
};

function mockPrisma(store: Store) {
  return {
    user: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; deletedAt: null };
      }) =>
        store.users.find((u) => u.id === where.id && !u.deletedAt) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { nickname: string };
      }) => {
        const u = store.users.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return u;
      },
    },
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        store.audits.push(data);
        return data;
      },
    },
  };
}

describe('AuthService.updateProfile', () => {
  let store: Store;
  let svc: AuthService;

  beforeEach(() => {
    store = {
      users: [
        {
          id: 'u1',
          mobileE164: '+8613800138000',
          nickname: '旧名',
          mobileVerified: true,
          email: null,
          avatarUrl: null,
          deletedAt: null,
        },
      ],
      audits: [],
    };
    svc = new AuthService(
      mockPrisma(store) as never,
      {} as never,
      {} as never,
    );
  });

  it('updates nickname and audits', async () => {
    const r = await svc.updateProfile('u1', { nickname: '  新昵称  ' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.nickname, '新昵称');
    assert.equal(store.users[0].nickname, '新昵称');
    assert.equal(store.audits.length, 1);
  });

  it('rejects empty nickname', async () => {
    const r = await svc.updateProfile('u1', { nickname: '   ' });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 400);
  });

  it('rejects overlong nickname', async () => {
    const r = await svc.updateProfile('u1', { nickname: 'x'.repeat(65) });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 400);
  });

  it('404 when user missing', async () => {
    const r = await svc.updateProfile('missing', { nickname: 'A' });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });
});
