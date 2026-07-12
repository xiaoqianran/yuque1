import type { KvStore } from './kv-store';

type Entry = { value: string; expiresAt?: number };

/** In-memory KV for unit tests and REDIS_URL-less local smoke of pure logic. */
export class MemoryKvStore implements KvStore {
  private readonly map = new Map<string, Entry>();

  private alive(key: string): Entry | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt !== undefined && Date.now() > e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e;
  }

  async get(key: string): Promise<string | null> {
    return this.alive(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.map.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async incr(key: string): Promise<number> {
    const cur = this.alive(key);
    const n = (cur ? Number(cur.value) : 0) + 1;
    const expiresAt = cur?.expiresAt;
    this.map.set(key, { value: String(n), expiresAt });
    return n;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const cur = this.alive(key);
    if (!cur) return;
    this.map.set(key, {
      value: cur.value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async ping(): Promise<boolean> {
    return true;
  }

  clear(): void {
    this.map.clear();
  }
}
