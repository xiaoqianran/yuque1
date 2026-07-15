import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ShareLink, TreeNode } from '@prisma/client';
import { ulid } from '../../common/ulid';
import { PrismaService } from '../prisma/prisma.service';
import type {
  KbRole,
  ServiceResult,
  ShareInfo,
  SharedDocument,
} from './share.types';

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound<T = never>(): ServiceResult<T> {
    return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
  }

  private canWrite(role: KbRole): boolean {
    return role === 'owner' || role === 'editor';
  }

  /** CSPRNG ≥ 128 bit，URL-safe，长度 ≤ 64 */
  private newToken(): string {
    return randomBytes(24).toString('base64url'); // 32 chars
  }

  private toShareInfo(link: ShareLink | null): ShareInfo {
    if (!link || !link.enabled) {
      return {
        enabled: false,
        token: null,
        urlPath: null,
        expiresAt: null,
      };
    }
    return {
      enabled: true,
      token: link.token,
      urlPath: `/s/${link.token}`,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
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
      include: { kb: true },
    });
    if (!node || node.type !== 'doc' || node.kb.deletedAt) {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    const m = await this.membership(node.knowledgeBaseId, userId);
    if (!m) {
      return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
    }
    return { ok: true, node, role: m.role };
  }

  async getStatus(
    userId: string,
    nodeId: string,
  ): Promise<ServiceResult<ShareInfo>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;

    const link = await this.prisma.shareLink.findFirst({
      where: { nodeId, enabled: true },
    });
    return { ok: true, data: this.toShareInfo(link) };
  }

  async enable(
    userId: string,
    nodeId: string,
    input?: { expiresAt?: string | null },
  ): Promise<ServiceResult<ShareInfo>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    let expiresAt: Date | null = null;
    if (input?.expiresAt != null && input.expiresAt !== '') {
      const d = new Date(input.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'expiresAt 不是有效时间',
          http: 400,
        };
      }
      // 至少预留 30s 时钟偏差；过期时间必须在未来
      if (d.getTime() <= Date.now() + 30_000) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'expiresAt 必须是未来时间',
          http: 400,
        };
      }
      expiresAt = d;
    }

    const existing = await this.prisma.shareLink.findFirst({
      where: { nodeId, enabled: true },
    });
    if (existing) {
      // 幂等：已启用则可选更新 expiresAt
      if (input && Object.prototype.hasOwnProperty.call(input, 'expiresAt')) {
        const updated = await this.prisma.shareLink.update({
          where: { id: existing.id },
          data: { expiresAt },
        });
        return { ok: true, data: this.toShareInfo(updated) };
      }
      return { ok: true, data: this.toShareInfo(existing) };
    }

    const created = await this.prisma.shareLink.create({
      data: {
        id: ulid(),
        token: this.newToken(),
        nodeId,
        enabled: true,
        expiresAt,
        createdBy: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: userId,
        action: 'share.enable',
        resourceType: 'share',
        resourceId: created.id,
        metadata: {
          nodeId,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        },
      },
    });

    return { ok: true, data: this.toShareInfo(created) };
  }

  async disable(
    userId: string,
    nodeId: string,
  ): Promise<ServiceResult<null>> {
    const r = await this.loadDocNode(userId, nodeId);
    if (!r.ok) return r;
    if (!this.canWrite(r.role)) return this.notFound();

    const existing = await this.prisma.shareLink.findFirst({
      where: { nodeId, enabled: true },
    });
    if (existing) {
      await this.prisma.shareLink.update({
        where: { id: existing.id },
        data: { enabled: false },
      });
      await this.prisma.auditLog.create({
        data: {
          id: ulid(),
          actorUserId: userId,
          action: 'share.disable',
          resourceType: 'share',
          resourceId: existing.id,
          metadata: { nodeId },
        },
      });
    }
    // 幂等：无启用中的分享也 200
    return { ok: true, data: null };
  }

  /** 公开只读；无效统一 404 */
  async getByToken(token: string): Promise<ServiceResult<SharedDocument>> {
    const t = token?.trim() ?? '';
    if (t.length < 16 || t.length > 64) {
      return this.notFound();
    }

    const link = await this.prisma.shareLink.findUnique({
      where: { token: t },
      include: {
        node: {
          include: {
            kb: true,
            content: true,
          },
        },
      },
    });

    if (!link || !link.enabled) return this.notFound();
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
      return this.notFound();
    }

    const node = link.node;
    if (
      !node ||
      node.deletedAt ||
      node.type !== 'doc' ||
      node.kb.deletedAt ||
      !node.content
    ) {
      return this.notFound();
    }

    return {
      ok: true,
      data: {
        title: node.title,
        bodyMd: node.content.bodyMd,
        updatedAt: node.content.updatedAt.toISOString(),
      },
    };
  }
}
