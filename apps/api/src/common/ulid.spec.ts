import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ulid } from './ulid';

describe('ulid', () => {
  it('returns 26 crockford chars', () => {
    const id = ulid();
    assert.equal(id.length, 26);
    assert.match(id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
