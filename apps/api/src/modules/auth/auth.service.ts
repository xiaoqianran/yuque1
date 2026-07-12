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

  async logout(sid: string | undefined): Promise<void> {
    if (sid) await this.sessions.destroy(sid);
  }

  async resolveSessionUserId(sid: string | undefined): Promise<string | null> {
    if (!sid) return null;
    const sess = await this.sessions.get(sid);
    return sess?.userId ?? null;
  }
}
