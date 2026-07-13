import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './types';

describe('ApiError', () => {
  it('carries code and http status', () => {
    const e = new ApiError('DOC_VERSION_CONFLICT', '冲突', 409, {
      serverVersion: 2,
    });
    assert.equal(e.code, 'DOC_VERSION_CONFLICT');
    assert.equal(e.http, 409);
    assert.equal(e.details?.serverVersion, 2);
  });
});
