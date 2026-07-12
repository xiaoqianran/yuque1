import { Global, Module, Provider } from '@nestjs/common';
import Redis from 'ioredis';
import type { KvStore } from './kv-store';
import { MemoryKvStore } from './memory-kv.store';
import { RedisKvStore } from './redis-kv.store';

export const KV_STORE = Symbol('KV_STORE');

const kvProvider: Provider = {
  provide: KV_STORE,
  useFactory: (): KvStore => {
    const url = process.env.REDIS_URL;
    if (!url || process.env.KV_DRIVER === 'memory') {
      return new MemoryKvStore();
    }
    const redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    redis.on('error', (err) => {
      console.error('[redis]', err.message);
    });
    return new RedisKvStore(redis);
  },
};

@Global()
@Module({
  providers: [kvProvider],
  exports: [KV_STORE],
})
export class KvModule {}
