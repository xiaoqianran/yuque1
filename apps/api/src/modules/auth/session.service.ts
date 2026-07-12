import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { KV_STORE } from '../kv/kv.module';
import type { KvStore } from '../kv/kv-store';
import type { SessionPayload } from './auth.types';

@Injectable()
export class SessionService {
  constructor(@Inject(KV_STORE) private readonly kv: KvStore) {}

  private ttlSeconds(): number {
    const days = Number(process.env.SESSION_TTL_DAYS ?? 7);
    return Math.max(1, days) * 24 * 3600;
  }

  private key(sid: string): string {
    return `sess:${sid}`;
  }

  async create(userId: string): Promise<string> {
    const sid = randomBytes(24).toString('base64url');
    const payload: SessionPayload = {
      userId,
      createdAt: new Date().toISOString(),
    };
    await this.kv.set(this.key(sid), JSON.stringify(payload), this.ttlSeconds());
    return sid;
  }

  async get(sid: string): Promise<SessionPayload | null> {
    const raw = await this.kv.get(this.key(sid));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionPayload;
    } catch {
      return null;
    }
  }

  async destroy(sid: string): Promise<void> {
    await this.kv.del(this.key(sid));
  }
}
