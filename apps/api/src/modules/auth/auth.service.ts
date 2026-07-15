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

  /**
   * Update current user profile fields (MVP: nickname).
   */
  async updateProfile(
    userId: string,
    input: { nickname?: string },
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

    if (!Object.prototype.hasOwnProperty.call(input, 'nickname')) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '须提供 nickname',
        http: 400,
      };
    }

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

    if (nick === user.nickname) {
      return { ok: true, data: this.toPublic(user) };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: nick },
    });

    await this.prisma.auditLog.create({
      data: {
        id: ulid(),
        actorUserId: userId,
        action: 'user.update_profile',
        resourceType: 'user',
        resourceId: userId,
        metadata: {
          fields: ['nickname'],
          from: user.nickname,
          to: nick,
        },
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
