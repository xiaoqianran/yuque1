import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { ulid } from '../../common/ulid';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicUser } from './auth.types';
import { SessionService } from './session.service';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly sessions: SessionService,
  ) {}

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      mobileE164: user.mobileE164,
      nickname: user.nickname,
      mobileVerified: user.mobileVerified,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  async sendSms(mobileE164: string) {
    return this.sms.sendCode(mobileE164.trim());
  }

  async loginWithSms(
    mobileE164: string,
    code: string,
    nickname?: string,
  ): Promise<
    | { ok: true; user: PublicUser; sid: string }
    | {
        ok: false;
        code: string;
        message: string;
        http: number;
      }
  > {
    const mobile = mobileE164.trim();
    const verified = await this.sms.verifyAndConsume(mobile, code.trim());
    if (!verified.ok) {
      const http = verified.code === 'AUTH_LOCKED' ? 429 : 400;
      return { ok: false, code: verified.code, message: verified.message, http };
    }

    let user = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
    });

    if (!user) {
      const userId = ulid();
      const workspaceId = ulid();
      const nick =
        nickname?.trim() ||
        `用户${mobile.slice(-4)}`;
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            id: userId,
            mobileE164: mobile,
            mobileVerified: true,
            nickname: nick.slice(0, 64),
          },
        });
        await tx.workspace.create({
          data: {
            id: workspaceId,
            ownerUserId: userId,
            name: '我的空间',
          },
        });
        return created;
      });
    }

    const sid = await this.sessions.create(user.id);
    return { ok: true, user: this.toPublic(user), sid };
  }

  async me(userId: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    return user ? this.toPublic(user) : null;
  }

  /** Loose email check (MVP 不验证所有权). */
  private normalizeEmail(
    raw: string | null | undefined,
  ):
    | { ok: true; email: string | null }
    | { ok: false; message: string } {
    if (raw == null) return { ok: true, email: null };
    const t = raw.trim();
    if (!t) return { ok: true, email: null };
    if (t.length > 255) {
      return { ok: false, message: '邮箱不超过 255 字' };
    }
    // Practical subset: local@domain with at least one dot in domain
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
      return { ok: false, message: '邮箱格式无效' };
    }
    return { ok: true, email: t.toLowerCase() };
  }

  /**
   * Update current user profile (nickname and/or optional email).
   * At least one field must be provided. Email is not verified (P1).
   */
  async updateProfile(
    userId: string,
    input: { nickname?: string; email?: string | null },
  ): Promise<
    | { ok: true; data: PublicUser }
    | { ok: false; code: string; message: string; http: number }
  > {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      return { ok: false, code: 'NOT_FOUND', message: '用户不存在', http: 404 };
    }

    const hasNick = Object.prototype.hasOwnProperty.call(input, 'nickname');
    const hasEmail = Object.prototype.hasOwnProperty.call(input, 'email');
    if (!hasNick && !hasEmail) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '须提供 nickname 和/或 email',
        http: 400,
      };
    }

    const data: { nickname?: string; email?: string | null } = {};
    const fields: string[] = [];
    const from: Record<string, string | null> = {};
    const to: Record<string, string | null> = {};

    if (hasNick) {
      const nick = (input.nickname ?? '').trim();
      if (!nick) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '昵称不能为空',
          http: 400,
        };
      }
      if (nick.length > 64) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: '昵称不超过 64 字',
          http: 400,
        };
      }
      if (nick !== user.nickname) {
        data.nickname = nick;
        fields.push('nickname');
        from.nickname = user.nickname;
        to.nickname = nick;
      }
    }

    if (hasEmail) {
      const em = this.normalizeEmail(input.email);
      if (!em.ok) {
        return {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: em.message,
          http: 400,
        };
      }
      const prev = user.email?.toLowerCase() ?? null;
      if (em.email !== prev) {
        data.email = em.email;
        fields.push('email');
        from.email = user.email;
        to.email = em.email;
      }
    }

    if (fields.length === 0) {
      return { ok: true, data: this.toPublic(user) };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: userId,
        action: 'user.update_profile',
        resourceType: 'user',
        resourceId: userId,
        metadata: { fields, from, to },
      },
    });

    return { ok: true, data: this.toPublic(updated) };
  }

  async logout(sid: string | undefined): Promise<void> {
    if (sid) await this.sessions.destroy(sid);
  }

  async resolveSessionUserId(sid: string | undefined): Promise<string | null> {
    if (!sid) return null;
    const sess = await this.sessions.get(sid);
    return sess?.userId ?? null;
  }
}
