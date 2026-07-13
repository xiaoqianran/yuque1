import { Injectable } from '@nestjs/common';
import type { DocumentContent, TreeNode, User } from '@prisma/client';
import { ulid } from '../../common/ulid';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ContentMetaDto,
  DocumentContentDto,
  KbRole,
  PublicNode,
  ServiceResult,
  UserBrief,
} from './content.types';

const DEFAULT_BODY_MAX = 2_097_152;

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private bodyMaxBytes(): number {
    const n = Number(process.env.BODY_MD_MAX_BYTES ?? DEFAULT_BODY_MAX);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_BODY_MAX;
  }

  private notFound<T = never>(): ServiceResult<T> {
    return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
  }

  private canWrite(role: KbRole): boolean {
    return role === 'owner' || role === 'editor';
  }

  private utf8Bytes(s: string): number {
    return Buffer.byteLength(s, 'utf8');
  }

  private validateBody(bodyMd: unknown): ServiceResult<string> {
    if (typeof bodyMd !== 'string') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'bodyMd 必须为字符串',
        http: 400,
      };
    }
    if (this.utf8Bytes(bodyMd) > this.bodyMaxBytes()) {
      return {
        ok: false,
        code: 'PAYLOAD_TOO_LARGE',
        message: '正文超过 2MB 限制',
        http: 413,
      };
    }
    return { ok: true, data: bodyMd };
  }

  private toUserBrief(u: Pick<User, 'id' | 'nickname'> | null): UserBrief | null {
    if (!u) return null;
    return { id: u.id, nickname: u.nickname };
  }

  private toContentDto(
    c: DocumentContent,
    updatedBy: UserBrief | null,
  ): DocumentContentDto {
    return {
      nodeId: c.nodeId,
      bodyMd: c.bodyMd,
      version: c.contentVersion,
      updatedAt: c.updatedAt.toISOString(),
      updatedBy,
    };
  }

  private toMeta(c: DocumentContent): ContentMetaDto {
    return {
      nodeId: c.nodeId,
      version: c.contentVersion,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  private toPublicNode(n: TreeNode): PublicNode {
    return {
      id: n.id,
      knowledgeBaseId: n.knowledgeBaseId,
      parentId: n.parentId,
      type: n.type as 'folder' | 'doc',
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

  private async loadDocNode(
    userId: string,
    nodeId: string,
  ): Promise<
    | { ok: true; node: TreeNode; role: KbRole }
    | { ok: false; code: string; message: string; http: number }
  > {
    const node = await this.prisma.treeNode.findFirst({
      where: { id: nodeId, deletedAt: null },
    });
    if (!node || node.type !== 'doc') {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    const m = await this.membership(node.knowledgeBaseId, userId);
    if (!m) {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    return { ok: true, node, role: m.role };
  }

  private async conflictDetails(
    nodeId: string,
  ): Promise<Record<string, unknown>> {
    const c = await this.prisma.documentContent.findUnique({
      where: { nodeId },
    });
    if (!c) {
      return { serverVersion: 0 };
    }
    let updatedBy: UserBrief | null = null;
    if (c.updatedBy) {
      const u = await this.prisma.user.findUnique({
        where: { id: c.updatedBy },
        select: { id: true, nickname: true },
      });
      updatedBy = this.toUserBrief(u);
    }
    return {
      serverVersion: c.contentVersion,
      updatedAt: c.updatedAt.toISOString(),
      updatedBy,
    };
  }

  async get(
    userId: string,
    nodeId: string,
  ): Promise<ServiceResult<DocumentContentDto>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;

    const c = await this.prisma.documentContent.findUnique({
      where: { nodeId },
    });
    if (!c) return this.notFound();

    let updatedBy: UserBrief | null = null;
    if (c.updatedBy) {
      const u = await this.prisma.user.findUnique({
        where: { id: c.updatedBy },
        select: { id: true, nickname: true },
      });
      updatedBy = this.toUserBrief(u);
    }
    return { ok: true, data: this.toContentDto(c, updatedBy) };
  }

  async put(
    userId: string,
    nodeId: string,
    input: { expectedVersion?: number; bodyMd?: unknown },
  ): Promise<ServiceResult<ContentMetaDto>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const expectedVersion = input.expectedVersion;
    if (
      expectedVersion == null ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'expectedVersion 必须为 >= 1 的整数',
        http: 400,
      };
    }

    const body = this.validateBody(input.bodyMd);
    if (!body.ok) return body;

    const result = await this.prisma.documentContent.updateMany({
      where: { nodeId, contentVersion: expectedVersion },
      data: {
        bodyMd: body.data,
        contentVersion: { increment: 1 },
        updatedBy: userId,
      },
    });

    if (result.count === 0) {
      const exists = await this.prisma.documentContent.findUnique({
        where: { nodeId },
      });
      if (!exists) return this.notFound();
      return {
        ok: false,
        code: 'DOC_VERSION_CONFLICT',
        message: '文档已被他人更新',
        http: 409,
        details: await this.conflictDetails(nodeId),
      };
    }

    const c = await this.prisma.documentContent.findUniqueOrThrow({
      where: { nodeId },
    });
    return { ok: true, data: this.toMeta(c) };
  }

  async overwrite(
    userId: string,
    nodeId: string,
    input: { baseVersion?: number; bodyMd?: unknown },
  ): Promise<ServiceResult<ContentMetaDto>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const baseVersion = input.baseVersion;
    if (baseVersion == null || !Number.isInteger(baseVersion) || baseVersion < 1) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'baseVersion 必须为 >= 1 的整数',
        http: 400,
      };
    }

    const body = this.validateBody(input.bodyMd);
    if (!body.ok) return body;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const current = await tx.documentContent.findFirst({
          where: { nodeId, contentVersion: baseVersion },
        });
        if (!current) return null;

        await tx.contentRevision.create({
          data: {
            id: ulid(),
            nodeId,
            version: current.contentVersion,
            bodyMd: current.bodyMd,
            reason: 'overwrite_on_conflict',
            createdBy: userId,
          },
        });

        const result = await tx.documentContent.updateMany({
          where: { nodeId, contentVersion: baseVersion },
          data: {
            bodyMd: body.data,
            contentVersion: { increment: 1 },
            updatedBy: userId,
          },
        });
        if (result.count !== 1) {
          throw new Error('OVERWRITE_RACE');
        }

        await tx.auditLog.create({
          data: {
            id: ulid(),
            actorUserId: userId,
            action: 'doc.overwrite_on_conflict',
            resourceType: 'node',
            resourceId: nodeId,
            metadata: {
              baseVersion,
              newVersion: baseVersion + 1,
            },
          },
        });

        return tx.documentContent.findUniqueOrThrow({ where: { nodeId } });
      });

      if (!updated) {
        const exists = await this.prisma.documentContent.findUnique({
          where: { nodeId },
        });
        if (!exists) return this.notFound();
        return {
          ok: false,
          code: 'DOC_VERSION_CONFLICT',
          message: '文档已被他人更新',
          http: 409,
          details: await this.conflictDetails(nodeId),
        };
      }

      return { ok: true, data: this.toMeta(updated) };
    } catch (e) {
      if (e instanceof Error && e.message === 'OVERWRITE_RACE') {
        return {
          ok: false,
          code: 'DOC_VERSION_CONFLICT',
          message: '文档已被他人更新',
          http: 409,
          details: await this.conflictDetails(nodeId),
        };
      }
      throw e;
    }
  }

  async saveAs(
    userId: string,
    nodeId: string,
    input: {
      bodyMd?: unknown;
      title?: string;
      parentId?: string | null;
    },
  ): Promise<ServiceResult<{ node: PublicNode; content: DocumentContentDto }>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const body = this.validateBody(input.bodyMd);
    if (!body.ok) return body;

    let title = input.title?.trim();
    if (!title) {
      title = `${r.node.title} (冲突副本)`;
    }
    if (title.length > 512) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '标题不能为空且不超过 512 字',
        http: 400,
      };
    }

    const parentId =
      input.parentId === undefined ? r.node.parentId : input.parentId;

    if (parentId) {
      const parent = await this.prisma.treeNode.findFirst({
        where: {
          id: parentId,
          knowledgeBaseId: r.node.knowledgeBaseId,
          deletedAt: null,
        },
      });
      if (!parent) return this.notFound();
    }

    const agg = await this.prisma.treeNode.aggregate({
      where: {
        knowledgeBaseId: r.node.knowledgeBaseId,
        parentId,
        deletedAt: null,
      },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? 0) + 1000;
    const newId = ulid();

    const { node, content } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.treeNode.create({
        data: {
          id: newId,
          knowledgeBaseId: r.node.knowledgeBaseId,
          parentId,
          type: 'doc',
          title,
          sortOrder,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      const c = await tx.documentContent.create({
        data: {
          nodeId: newId,
          bodyMd: body.data,
          contentVersion: 1,
          updatedBy: userId,
        },
      });
      return { node: created, content: c };
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true },
    });

    return {
      ok: true,
      data: {
        node: this.toPublicNode(node),
        content: this.toContentDto(content, this.toUserBrief(user)),
      },
    };
  }
}
