import { connect } from 'node:net';

/** Lightweight TCP reachability check for Redis (M0; full PING in M1). */
export function pingRedisUrl(redisUrl: string, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const u = new URL(redisUrl);
      const host = u.hostname || '127.0.0.1';
      const port = Number(u.port || 6379);
      const socket = connect({ host, port });
      const done = (ok: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    } catch {
      resolve(false);
    }
  });
}
