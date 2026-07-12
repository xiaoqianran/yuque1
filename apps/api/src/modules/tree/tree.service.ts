import { Injectable } from '@nestjs/common';
import type { TreeNode } from '@prisma/client';
import { ulid } from '../../common/ulid';
import { PrismaService } from '../prisma/prisma.service';
import type {
  KbRole,
  NodeType,
  PublicNode,
  ServiceResult,
} from './tree.types';

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService) {}

  toPublic(n: TreeNode): PublicNode {
    return {
      id: n.id,
      knowledgeBaseId: n.knowledgeBaseId,
      parentId: n.parentId,
      type: n.type as NodeType,
      title: n.title,
      sortOrder: n.sortOrder,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }

  private async membership(
    kbId: string,
    userId: string,
  ): Promise<{ role: KbRole } | null> {
    const row = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: { knowledgeBaseId: kbId, userId },
      },
      include: { kb: true },
    });
    if (!row || row.kb.deletedAt) return null;
    return { role: row.role as KbRole };
  }

  private canWrite(role: KbRole): boolean {
    return role === 'owner' || role === 'editor';
  }

  private notFound<T = never>(): ServiceResult<T> {
    return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
  }

  private notFoundAccess(): {
    ok: false;
    code: string;
    message: string;
    http: number;
  } {
    return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
  }

  private async nextSortOrder(
    kbId: string,
    parentId: string | null,
  ): Promise<number> {
    const agg = await this.prisma.treeNode.aggregate({
      where: {
        knowledgeBaseId: kbId,
        parentId,
        deletedAt: null,
      },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? 0) + 1000;
  }

  async getTree(
    userId: string,
    kbId: string,
  ): Promise<ServiceResult<{ items: PublicNode[] }>> {
    const m = await this.membership(kbId, userId);
    if (!m) return this.notFound();

    const rows = await this.prisma.treeNode.findMany({
      where: { knowledgeBaseId: kbId, deletedAt: null },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { ok: true, data: { items: rows.map((r) => this.toPublic(r)) } };
  }

  async search(
    userId: string,
    kbId: string,
    q: string,
    limit = 50,
  ): Promise<ServiceResult<{ items: PublicNode[] }>> {
    const m = await this.membership(kbId, userId);
    if (!m) return this.notFound();

    const query = q?.trim() ?? '';
    if (!query || query.length > 200) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '搜索词不能为空且不超过 200 字',
        http: 400,
      };
    }
    const take = Math.min(100, Math.max(1, limit));
    const rows = await this.prisma.treeNode.findMany({
      where: {
        knowledgeBaseId: kbId,
        deletedAt: null,
        title: { contains: query, mode: 'insensitive' },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take,
    });
    return { ok: true, data: { items: rows.map((r) => this.toPublic(r)) } };
  }

  async create(
    userId: string,
    kbId: string,
    input: { type?: string; title?: string; parentId?: string | null },
  ): Promise<ServiceResult<PublicNode>> {
    const m = await this.membership(kbId, userId);
    if (!m) return this.notFound();
    if (!this.canWrite(m.role)) return this.notFound();

    const type = input.type as NodeType;
    if (type !== 'folder' && type !== 'doc') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'type 必须为 folder 或 doc',
        http: 400,
      };
    }
    const title = input.title?.trim() ?? '';
    if (!title || title.length > 512) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '标题不能为空且不超过 512 字',
        http: 400,
      };
    }

    const parentId =
      input.parentId === undefined || input.parentId === null
        ? null
        : input.parentId;

    if (parentId) {
      const parent = await this.prisma.treeNode.findFirst({
        where: {
          id: parentId,
          knowledgeBaseId: kbId,
          deletedAt: null,
        },
      });
      if (!parent) return this.notFound();
      // parent 可为 folder 或 doc（P0）
    }

    const sortOrder = await this.nextSortOrder(kbId, parentId);
    const id = ulid();

    const node = await this.prisma.$transaction(async (tx) => {
      const created = await tx.treeNode.create({
        data: {
          id,
          knowledgeBaseId: kbId,
          parentId,
          type,
          title,
          sortOrder,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      if (type === 'doc') {
        await tx.documentContent.create({
          data: {
            nodeId: id,
            bodyMd: '',
            contentVersion: 1,
            updatedBy: userId,
          },
        });
      }
      return created;
    });

    return { ok: true, data: this.toPublic(node) };
  }

  private async loadAccessibleNode(
    userId: string,
    nodeId: string,
  ): Promise<
    | { ok: true; node: TreeNode; role: KbRole }
    | { ok: false; code: string; message: string; http: number }
  > {
    const node = await this.prisma.treeNode.findFirst({
      where: { id: nodeId, deletedAt: null },
    });
    if (!node) return this.notFoundAccess();
    const m = await this.membership(node.knowledgeBaseId, userId);
    if (!m) return this.notFoundAccess();
    return { ok: true, node, role: m.role };
  }

  async get(
    userId: string,
    nodeId: string,
  ): Promise<ServiceResult<PublicNode>> {
    const r = await this.loadAccessibleNode(userId, nodeId);
    if (!r.ok) return r;
    return { ok: true, data: this.toPublic(r.node) };
  }

  async update(
    userId: string,
    nodeId: string,
    titleRaw?: string,
  ): Promise<ServiceResult<PublicNode>> {
    const r = await this.loadAccessibleNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const title = titleRaw?.trim() ?? '';
    if (!title || title.length > 512) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '标题不能为空且不超过 512 字',
        http: 400,
      };
    }

    const updated = await this.prisma.treeNode.update({
      where: { id: nodeId },
      data: { title, updatedBy: userId },
    });
    return { ok: true, data: this.toPublic(updated) };
  }

  async delete(
    userId: string,
    nodeId: string,
  ): Promise<ServiceResult<null>> {
    const r = await this.loadAccessibleNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const childCount = await this.prisma.treeNode.count({
      where: { parentId: nodeId, deletedAt: null },
    });
    if (childCount > 0) {
      return {
        ok: false,
        code: 'NODE_HAS_CHILDREN',
        message: '存在未删除子节点，无法删除',
        http: 409,
        details: { childCount },
      };
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.treeNode.update({
        where: { id: nodeId },
        data: { deletedAt: now, updatedBy: userId },
      });
      await tx.shareLink.updateMany({
        where: { nodeId, enabled: true },
        data: { enabled: false },
      });
      await tx.auditLog.create({
        data: {
          id: ulid(),
          actorUserId: userId,
          action: 'node.delete',
          resourceType: 'node',
          resourceId: nodeId,
          metadata: { knowledgeBaseId: r.node.knowledgeBaseId },
        },
      });
    });

    return { ok: true, data: null };
  }

  /**
   * 若 newParent 是 node 的后代（或自身），则成环。
   */
  private async wouldCreateCycle(
    nodeId: string,
    newParentId: string,
  ): Promise<boolean> {
    if (newParentId === nodeId) return true;
    let cursor: string | null = newParentId;
    // 防无限：深度上限
    for (let i = 0; i < 10_000 && cursor; i++) {
      if (cursor === nodeId) return true;
      const row: { parentId: string | null } | null =
        await this.prisma.treeNode.findFirst({
          where: { id: cursor, deletedAt: null },
          select: { parentId: true },
        });
      if (!row) break;
      cursor = row.parentId;
    }
    return false;
  }

  async move(
    userId: string,
    nodeId: string,
    input: { parentId?: string | null; sortOrder?: number },
  ): Promise<ServiceResult<PublicNode>> {
    const r = await this.loadAccessibleNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    if (!Object.prototype.hasOwnProperty.call(input, 'parentId')) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '必须提供 parentId（null 表示库根）',
        http: 400,
      };
    }

    const newParentId = input.parentId ?? null;
    if (newParentId) {
      const parent = await this.prisma.treeNode.findFirst({
        where: {
          id: newParentId,
          knowledgeBaseId: r.node.knowledgeBaseId,
          deletedAt: null,
        },
      });
      if (!parent) return this.notFound();
      if (await this.wouldCreateCycle(nodeId, newParentId)) {
        return {
          ok: false,
          code: 'NODE_CYCLE_DETECTED',
          message: '不能将节点移动到其子树下',
          http: 409,
        };
      }
    }

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined || !Number.isFinite(sortOrder)) {
      sortOrder = await this.nextSortOrder(r.node.knowledgeBaseId, newParentId);
    } else {
      sortOrder = Math.trunc(sortOrder);
    }

    const updated = await this.prisma.treeNode.update({
      where: { id: nodeId },
      data: {
        parentId: newParentId,
        sortOrder,
        updatedBy: userId,
      },
    });
    return { ok: true, data: this.toPublic(updated) };
  }
}
