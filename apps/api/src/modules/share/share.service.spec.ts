import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ShareService } from './share.service';

type Store = {
  members: { knowledgeBaseId: string; userId: string; role: string; kbDeleted: boolean }[];
  nodes: {
    id: string;
    knowledgeBaseId: string;
    type: string;
    title: string;
    deletedAt: Date | null;
    kbDeleted: boolean;
  }[];
  contents: { nodeId: string; bodyMd: string; updatedAt: Date }[];
  shares: {
    id: string;
    token: string;
    nodeId: string;
    enabled: boolean;
    expiresAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
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
      findFirst: async ({ where }: { where: { id: string; deletedAt: null } }) => {
        const n = store.nodes.find((x) => x.id === where.id && !x.deletedAt);
        if (!n) return null;
        return {
          ...n,
          kb: { deletedAt: n.kbDeleted ? new Date() : null },
        };
      },
    },
    shareLink: {
      findFirst: async ({
        where,
      }: {
        where: { nodeId: string; enabled: boolean };
      }) =>
        store.shares.find(
          (s) => s.nodeId === where.nodeId && s.enabled === where.enabled,
        ) ?? null,
      findUnique: async ({ where }: { where: { token: string } }) => {
        const s = store.shares.find((x) => x.token === where.token);
        if (!s) return null;
        const n = store.nodes.find((x) => x.id === s.nodeId);
        const c = store.contents.find((x) => x.nodeId === s.nodeId);
        return {
          ...s,
          node: n
            ? {
                ...n,
                deletedAt: n.deletedAt,
                kb: { deletedAt: n.kbDeleted ? new Date() : null },
                content: c ?? null,
              }
            : null,
        };
      },
      create: async ({
        data,
      }: {
        data: {
          id: string;
          token: string;
          nodeId: string;
          enabled: boolean;
          expiresAt: Date | null;
          createdBy: string;
        };
      }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.shares.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<Store['shares'][0]>;
      }) => {
        const s = store.shares.find((x) => x.id === where.id)!;
        Object.assign(s, data, { updatedAt: new Date() });
        return s;
      },
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

describe('ShareService', () => {
  let store: Store;
  let svc: ShareService;

  beforeEach(() => {
    store = {
      members: [
        { knowledgeBaseId: 'kb1', userId: 'u1', role: 'owner', kbDeleted: false },
      ],
      nodes: [
        {
          id: 'n1',
          knowledgeBaseId: 'kb1',
          type: 'doc',
          title: '公开文档',
          deletedAt: null,
          kbDeleted: false,
        },
      ],
      contents: [
        { nodeId: 'n1', bodyMd: '# hi', updatedAt: new Date('2026-01-01') },
      ],
      shares: [],
      audits: [],
    };
    svc = new ShareService(mockPrisma(store) as never);
  });

  it('enable creates token and getByToken returns body', async () => {
    const en = await svc.enable('u1', 'n1');
    assert.equal(en.ok, true);
    if (!en.ok) return;
    assert.equal(en.data.enabled, true);
    assert.ok(en.data.token && en.data.token.length >= 16);
    assert.equal(en.data.urlPath, `/s/${en.data.token}`);
    assert.equal(store.audits.length, 1);

    const pub = await svc.getByToken(en.data.token!);
    assert.equal(pub.ok, true);
    if (!pub.ok) return;
    assert.equal(pub.data.title, '公开文档');
    assert.equal(pub.data.bodyMd, '# hi');
  });

  it('enable is idempotent when already enabled', async () => {
    const a = await svc.enable('u1', 'n1');
    assert.equal(a.ok, true);
    if (!a.ok) return;
    const b = await svc.enable('u1', 'n1');
    assert.equal(b.ok, true);
    if (!b.ok) return;
    assert.equal(a.data.token, b.data.token);
    assert.equal(store.shares.filter((s) => s.enabled).length, 1);
  });

  it('disable makes token unreadable', async () => {
    const en = await svc.enable('u1', 'n1');
    assert.equal(en.ok, true);
    if (!en.ok) return;
    const token = en.data.token!;
    const dis = await svc.disable('u1', 'n1');
    assert.equal(dis.ok, true);
    const pub = await svc.getByToken(token);
    assert.equal(pub.ok, false);
    if (pub.ok) return;
    assert.equal(pub.http, 404);
  });

  it('status reflects disabled when no active share', async () => {
    const st = await svc.getStatus('u1', 'n1');
    assert.equal(st.ok, true);
    if (!st.ok) return;
    assert.equal(st.data.enabled, false);
    assert.equal(st.data.token, null);
  });

  it('reader cannot enable', async () => {
    store.members[0].role = 'reader';
    const r = await svc.enable('u1', 'n1');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.http, 404);
  });

  it('expired share is not found', async () => {
    const en = await svc.enable('u1', 'n1');
    assert.equal(en.ok, true);
    if (!en.ok) return;
    store.shares[0].expiresAt = new Date(Date.now() - 1000);
    const pub = await svc.getByToken(en.data.token!);
    assert.equal(pub.ok, false);
  });
});
