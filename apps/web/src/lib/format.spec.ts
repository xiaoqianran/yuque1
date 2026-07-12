import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHealthLabel } from './format';

describe('formatHealthLabel', () => {
  it('formats status', () => {
    assert.equal(formatHealthLabel('ok'), 'API ok');
  });
});
