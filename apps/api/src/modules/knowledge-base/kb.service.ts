import { Injectable } from '@nestjs/common';
import type { KnowledgeBase, KbMember } from '@prisma/client';
import { ulid } from '../../common/ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { KbRole, PublicKb } from './kb.types';

@Injectable()
export class KbService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(kb: KnowledgeBase, role: KbRole): PublicKb {
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description,
      visibility: 'private',
      role,
      createdAt: kb.createdAt.toISOString(),
      updatedAt: kb.updatedAt.toISOString(),
    };
  }

  async list(
    userId: string,
    page = 1,
    pageSize = 50,
  ): Promise<{ items: PublicKb[]; page: number; pageSize: number; total: number }> {
    const p = Math.max(1, page);
    const ps = Math.min(100, Math.max(1, pageSize));
    const where = {
      userId,
      kb: { deletedAt: null },
    };
    const [total, rows] = await Promise.all([
      this.prisma.kbMember.count({ where }),
      this.prisma.kbMember.findMany({
        where,
        include: { kb: true },
        orderBy: { kb: { updatedAt: 'desc' } },
        skip: (p - 1) * ps,
        take: ps,
      }),
    ]);
    return {
      items: rows.map((r) => this.toPublic(r.kb, r.role as KbRole)),
      page: p,
      pageSize: ps,
      total,
    };
  }

  async create(
    userId: string,
    name: string,
    description?: string | null,
  ): Promise<
    | { ok: true; kb: PublicKb }
    | { ok: false; code: string; message: string; http: number }
  > {
    const trimmed = name?.trim() ?? '';
    if (!trimmed || trimmed.length > 128) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '知识库名称不能为空且不超过 128 字',
        http: 400,
      };
    }
    if (description != null && description.length > 2000) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '简介不超过 2000 字',
        http: 400,
      };
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { ownerUserId: userId },
    });
    if (!workspace) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: '用户空间不存在',
        http: 404,
      };
    }

    const kbId = ulid();
    const memberId = ulid();
    const kb = await this.prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeBase.create({
        data: {
          id: kbId,
          workspaceId: workspace.id,
          ownerUserId: userId,
          name: trimmed,
          description: description?.trim() || null,
          visibility: 'private',
        },
      });
      await tx.kbMember.create({
        data: {
          id: memberId,
          knowledgeBaseId: kbId,
          userId,
          role: 'owner',
        },
      });
      return created;
    });

    return { ok: true, kb: this.toPublic(kb, 'owner') };
  }

  private async membership(
    kbId: string,
    userId: string,
  ): Promise<(KbMember & { kb: KnowledgeBase }) | null> {
    const row = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: { knowledgeBaseId: kbId, userId },
      },
      include: { kb: true },
    });
    if (!row || row.kb.deletedAt) return null;
    return row;
  }

  async get(
    userId: string,
    kbId: string,
  ): Promise<
    | { ok: true; kb: PublicKb }
    | { ok: false; code: string; message: string; http: number }
  > {
    const m = await this.membership(kbId, userId);
    if (!m) {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    return { ok: true, kb: this.toPublic(m.kb, m.role as KbRole) };
  }

  async update(
    userId: string,
    kbId: string,
    patch: { name?: string; description?: string | null },
  ): Promise<
    | { ok: true; kb: PublicKb }
    | { ok: false; code: string; message: string; http: number }
  > {
    const m = await this.membership(kbId, userId);
    if (!m) {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    if (m.role === 'reader') {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    if (
      patch.name === undefined &&
      !Object.prototype.hasOwnProperty.call(patch, 'description')
    ) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '至少提供一个可更新字段',
        http: 400,
      };
    }

    const data: { name?: string; description?: string | null } = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n || n.length > 128) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '知识库名称不能为空且不超过 128 字',
          http: 400,
        };
      }
      data.name = n;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'description')) {
      const d = patch.description;
      if (d != null && d.length > 2000) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '简介不超过 2000 字',
          http: 400,
        };
      }
      data.description = d === undefined ? undefined : d?.trim() || null;
    }

    const updated = await this.prisma.knowledgeBase.update({
      where: { id: kbId },
      data,
    });
    return { ok: true, kb: this.toPublic(updated, m.role as KbRole) };
  }

  async delete(
    userId: string,
    kbId: string,
  ): Promise<
    | { ok: true }
    | { ok: false; code: string; message: string; http: number }
  > {
    const m = await this.membership(kbId, userId);
    if (!m || m.role !== 'owner') {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.knowledgeBase.update({
        where: { id: kbId },
        data: { deletedAt: now },
      });
      await tx.treeNode.updateMany({
        where: { knowledgeBaseId: kbId, deletedAt: null },
        data: { deletedAt: now },
      });
      const nodeIds = (
        await tx.treeNode.findMany({
          where: { knowledgeBaseId: kbId },
          select: { id: true },
        })
      ).map((n) => n.id);
      if (nodeIds.length > 0) {
        await tx.shareLink.updateMany({
          where: { nodeId: { in: nodeIds }, enabled: true },
          data: { enabled: false },
        });
      }
      await tx.auditLog.create({
        data: {
          id: ulid(),
          actorUserId: userId,
          action: 'kb.delete',
          resourceType: 'kb',
          resourceId: kbId,
          metadata: { cascadedNodes: nodeIds.length },
        },
      });
    });

    return { ok: true };
  }
}
