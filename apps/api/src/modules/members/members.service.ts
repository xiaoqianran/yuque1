import { Injectable } from '@nestjs/common';
import { ulid } from '../../common/ulid';
import { E164_RE } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AssignableRole,
  KbRole,
  PublicMember,
  ServiceResult,
} from './members.types';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  private notFound<T = never>(): ServiceResult<T> {
    return { ok: false, code: 'NOT_FOUND', message: '资源不存在', http: 404 };
  }

  private toPublic(row: {
    userId: string;
    role: string;
    createdAt: Date;
    user: { mobileE164: string; nickname: string };
  }): PublicMember {
    return {
      userId: row.userId,
      mobileE164: row.user.mobileE164,
      nickname: row.user.nickname,
      role: row.role as KbRole,
      createdAt: row.createdAt.toISOString(),
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

  private isAssignable(role: string): role is AssignableRole {
    return role === 'editor' || role === 'reader';
  }

  async list(
    actorId: string,
    kbId: string,
  ): Promise<ServiceResult<{ items: PublicMember[] }>> {
    const m = await this.membership(kbId, actorId);
    if (!m) return this.notFound();

    const rows = await this.prisma.kbMember.findMany({
      where: { knowledgeBaseId: kbId },
      include: { user: { select: { mobileE164: true, nickname: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    // owner first: owner < editor < reader alphabetically? editor, owner, reader - not ideal
    // sort manually: owner, editor, reader
    const order = { owner: 0, editor: 1, reader: 2 } as const;
    rows.sort(
      (a, b) =>
        (order[a.role as KbRole] ?? 9) - (order[b.role as KbRole] ?? 9) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

    return {
      ok: true,
      data: { items: rows.map((r) => this.toPublic(r)) },
    };
  }

  async add(
    actorId: string,
    kbId: string,
    input: { mobileE164?: string; role?: string },
  ): Promise<ServiceResult<PublicMember>> {
    const m = await this.membership(kbId, actorId);
    if (!m) return this.notFound();
    if (m.role !== 'owner') return this.notFound();

    const mobile = input.mobileE164?.trim() ?? '';
    if (!E164_RE.test(mobile)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '手机号须为 E.164 格式',
        http: 400,
      };
    }
    const role = input.role ?? '';
    if (!this.isAssignable(role)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '角色只能是 editor 或 reader',
        http: 400,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { mobileE164: mobile, deletedAt: null },
    });
    if (!user) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: '用户不存在（须先完成短信登录注册）',
        http: 404,
      };
    }
    if (user.id === actorId) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '不能重复添加自己',
        http: 400,
      };
    }

    const existing = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: {
          knowledgeBaseId: kbId,
          userId: user.id,
        },
      },
    });
    if (existing) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '该用户已是成员',
        http: 409,
      };
    }

    const created = await this.prisma.kbMember.create({
      data: {
        id: ulid(),
        knowledgeBaseId: kbId,
        userId: user.id,
        role,
      },
      include: { user: { select: { mobileE164: true, nickname: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: actorId,
        action: 'member.add',
        resourceType: 'kb',
        resourceId: kbId,
        metadata: { userId: user.id, role },
      },
    });

    return { ok: true, data: this.toPublic(created) };
  }

  async updateRole(
    actorId: string,
    kbId: string,
    targetUserId: string,
    roleRaw?: string,
  ): Promise<ServiceResult<PublicMember>> {
    const m = await this.membership(kbId, actorId);
    if (!m) return this.notFound();
    if (m.role !== 'owner') return this.notFound();

    const role = roleRaw ?? '';
    if (!this.isAssignable(role)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '角色只能是 editor 或 reader',
        http: 400,
      };
    }

    const target = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: {
          knowledgeBaseId: kbId,
          userId: targetUserId,
        },
      },
      include: { user: { select: { mobileE164: true, nickname: true } } },
    });
    if (!target) return this.notFound();
    if (target.role === 'owner') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '不能变更 owner 角色（转让 owner 未开放）',
        http: 409,
      };
    }

    const updated = await this.prisma.kbMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { mobileE164: true, nickname: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: actorId,
        action: 'member.update_role',
        resourceType: 'kb',
        resourceId: kbId,
        metadata: { userId: targetUserId, role },
      },
    });

    return { ok: true, data: this.toPublic(updated) };
  }

  async remove(
    actorId: string,
    kbId: string,
    targetUserId: string,
  ): Promise<ServiceResult<null>> {
    const m = await this.membership(kbId, actorId);
    if (!m) return this.notFound();
    if (m.role !== 'owner') return this.notFound();

    const target = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: {
          knowledgeBaseId: kbId,
          userId: targetUserId,
        },
      },
    });
    if (!target) return this.notFound();
    if (target.role === 'owner') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '不能移除 owner',
        http: 409,
      };
    }

    await this.prisma.kbMember.delete({ where: { id: target.id } });
    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: actorId,
        action: 'member.remove',
        resourceType: 'kb',
        resourceId: kbId,
        metadata: { userId: targetUserId },
      },
    });

    return { ok: true, data: null };
  }

  /**
   * Transfer owner: demote actor to editor, promote target to owner,
   * sync knowledge_bases.owner_user_id (Design-01).
   */
  async transferOwner(
    actorId: string,
    kbId: string,
    newOwnerUserId: string,
  ): Promise<ServiceResult<PublicMember>> {
    const m = await this.membership(kbId, actorId);
    if (!m) return this.notFound();
    if (m.role !== 'owner') return this.notFound();

    if (!newOwnerUserId || newOwnerUserId === actorId) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '须指定其他用户作为新 owner',
        http: 400,
      };
    }

    const target = await this.prisma.kbMember.findUnique({
      where: {
        knowledgeBaseId_userId: {
          knowledgeBaseId: kbId,
          userId: newOwnerUserId,
        },
      },
      include: { user: { select: { mobileE164: true, nickname: true } } },
    });
    if (!target) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: '目标用户不是本库成员',
        http: 404,
      };
    }
    if (target.role === 'owner') {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '目标已是 owner',
        http: 409,
      };
    }

    const newOwner = await this.prisma.$transaction(async (tx) => {
      await tx.kbMember.update({
        where: {
          knowledgeBaseId_userId: {
            knowledgeBaseId: kbId,
            userId: actorId,
          },
        },
        data: { role: 'editor' },
      });
      const promoted = await tx.kbMember.update({
        where: { id: target.id },
        data: { role: 'owner' },
        include: { user: { select: { mobileE164: true, nickname: true } } },
      });
      await tx.knowledgeBase.update({
        where: { id: kbId },
        data: { ownerUserId: newOwnerUserId },
      });
      await tx.auditLog.create({
        data: {
          id: ulid(),
          actorUserId: actorId,
          action: 'member.transfer_owner',
          resourceType: 'kb',
          resourceId: kbId,
          metadata: {
            fromUserId: actorId,
            toUserId: newOwnerUserId,
          },
        },
      });
      return promoted;
    });

    return { ok: true, data: this.toPublic(newOwner) };
  }
}
