import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expiresAtFromPreset,
  formatShareExpiry,
  isShareExpired,
} from './shareExpiry';

describe('shareExpiry', () => {
  const now = Date.parse('2026-07-15T12:00:00.000Z');

  it('expiresAtFromPreset never → null', () => {
    assert.equal(expiresAtFromPreset('never', now), null);
  });

  it('expiresAtFromPreset 1d/7d/30d offsets', () => {
    assert.equal(
      expiresAtFromPreset('1d', now),
      new Date(now + 86_400_000).toISOString(),
    );
    assert.equal(
      expiresAtFromPreset('7d', now),
      new Date(now + 7 * 86_400_000).toISOString(),
    );
    assert.equal(
      expiresAtFromPreset('30d', now),
      new Date(now + 30 * 86_400_000).toISOString(),
    );
  });

  it('isShareExpired', () => {
    assert.equal(isShareExpired(null, now), false);
    assert.equal(isShareExpired(new Date(now + 1000).toISOString(), now), false);
    assert.equal(isShareExpired(new Date(now - 1000).toISOString(), now), true);
  });

  it('formatShareExpiry', () => {
    assert.equal(formatShareExpiry(null, now), '有效期：永久');
    assert.match(
      formatShareExpiry(new Date(now - 1000).toISOString(), now),
      /^已过期/,
    );
    assert.match(
      formatShareExpiry(new Date(now + 86_400_000).toISOString(), now),
      /^有效期至 /,
    );
  });
});
