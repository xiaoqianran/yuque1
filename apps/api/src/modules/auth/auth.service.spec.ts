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
        data: { nickname?: string; email?: string | null };
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

  it('binds and clears email', async () => {
    let r = await svc.updateProfile('u1', { email: '  Alice@Example.COM ' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.email, 'alice@example.com');
    assert.equal(store.users[0].email, 'alice@example.com');

    r = await svc.updateProfile('u1', { email: null });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.email, null);
    assert.equal(store.users[0].email, null);
  });

  it('rejects invalid email', async () => {
    const r = await svc.updateProfile('u1', { email: 'not-an-email' });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 400);
  });

  it('requires at least one field', async () => {
    const r = await svc.updateProfile('u1', {});
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 400);
  });

  it('updates nickname and email together', async () => {
    const r = await svc.updateProfile('u1', {
      nickname: 'Bob',
      email: 'bob@example.com',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.data.nickname, 'Bob');
    assert.equal(r.data.email, 'bob@example.com');
  });
});
