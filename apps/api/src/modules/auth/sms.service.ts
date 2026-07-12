import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { KV_STORE } from '../kv/kv.module';
import type { KvStore } from '../kv/kv-store';
import { E164_RE, SMS_CODE_RE } from './auth.types';

export type SendSmsResult =
  | { ok: true }
  | { ok: false; code: 'VALIDATION_ERROR' | 'SMS_RATE_LIMITED'; message: string };

export type VerifySmsResult =
  | { ok: true }
  | {
      ok: false;
      code: 'VALIDATION_ERROR' | 'SMS_CODE_INVALID' | 'AUTH_LOCKED';
      message: string;
    };

@Injectable()
export class SmsService {
  constructor(@Inject(KV_STORE) private readonly kv: KvStore) {}

  private codeKey(mobile: string): string {
    return `sms:code:${mobile}`;
  }
  private gapKey(mobile: string): string {
    return `sms:gap:${mobile}`;
  }
  private dayKey(mobile: string): string {
    const d = new Date();
    const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    return `sms:day:${mobile}:${ymd}`;
  }
  private failKey(mobile: string): string {
    return `auth:fail:${mobile}`;
  }
  private lockKey(mobile: string): string {
    return `auth:lock:${mobile}`;
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  validateMobile(mobile: string): boolean {
    return E164_RE.test(mobile);
  }

  async sendCode(mobileE164: string): Promise<SendSmsResult> {
    if (!this.validateMobile(mobileE164)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '手机号须为 E.164 格式',
      };
    }

    if (await this.kv.get(this.gapKey(mobileE164))) {
      return {
        ok: false,
        code: 'SMS_RATE_LIMITED',
        message: '发送过于频繁，请稍后再试',
      };
    }

    const dayCount = Number((await this.kv.get(this.dayKey(mobileE164))) ?? '0');
    if (dayCount >= 20) {
      return {
        ok: false,
        code: 'SMS_RATE_LIMITED',
        message: '今日发送次数已达上限',
      };
    }

    const fixed = process.env.SMS_MOCK_CODE;
    const code =
      fixed && SMS_CODE_RE.test(fixed) ? fixed : String(randomInt(0, 1_000_000)).padStart(6, '0');

    // Provider mock: only log (never return code in HTTP body)
    if ((process.env.SMS_PROVIDER ?? 'mock') === 'mock') {
      console.log(`[sms:mock] to=${mobileE164} code=${code}`);
    }

    await this.kv.set(this.codeKey(mobileE164), this.hashCode(code), 5 * 60);
    await this.kv.set(this.gapKey(mobileE164), '1', 60);
    const n = await this.kv.incr(this.dayKey(mobileE164));
    if (n === 1) {
      await this.kv.expire(this.dayKey(mobileE164), 24 * 3600);
    }

    return { ok: true };
  }

  async verifyAndConsume(mobileE164: string, code: string): Promise<VerifySmsResult> {
    if (!this.validateMobile(mobileE164)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '手机号须为 E.164 格式',
      };
    }
    if (!SMS_CODE_RE.test(code)) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: '验证码须为 6 位数字',
      };
    }

    if (await this.kv.get(this.lockKey(mobileE164))) {
      return {
        ok: false,
        code: 'AUTH_LOCKED',
        message: '登录已锁定，请稍后再试',
      };
    }

    const stored = await this.kv.get(this.codeKey(mobileE164));
    if (!stored || stored !== this.hashCode(code)) {
      const fails = await this.kv.incr(this.failKey(mobileE164));
      if (fails === 1) {
        await this.kv.expire(this.failKey(mobileE164), 15 * 60);
      }
      if (fails >= 5) {
        await this.kv.set(this.lockKey(mobileE164), '1', 15 * 60);
        await this.kv.del(this.failKey(mobileE164));
        return {
          ok: false,
          code: 'AUTH_LOCKED',
          message: '登录已锁定，请稍后再试',
        };
      }
      return {
        ok: false,
        code: 'SMS_CODE_INVALID',
        message: '验证码错误或已过期',
      };
    }

    await this.kv.del(this.codeKey(mobileE164));
    await this.kv.del(this.failKey(mobileE164));
    return { ok: true };
  }
}
