/** Minimal Crockford Base32 ULID generator (no external dep for M0). */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len: number): string {
  let t = now;
  let out = '';
  for (let i = len; i > 0; i -= 1) {
    const mod = t % 32;
    out = ENCODING[mod] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeRandom(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ENCODING[Math.floor(Math.random() * 32)];
  }
  return out;
}

export function ulid(now = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}
