import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Models open-document request sequencing used by useDocumentSelection.
 * A slower earlier open must not overwrite a later open's body.
 */
function applyOpenResult(
  currentSeq: number,
  resultSeq: number,
  body: string,
  state: { body: string; seq: number },
): void {
  if (resultSeq !== currentSeq) return;
  state.body = body;
  state.seq = resultSeq;
}

describe('document open race', () => {
  it('ignores stale open results', async () => {
    const state = { body: '', seq: 0 };
    let seq = 0;

    // Start open A then open B
    const seqA = ++seq;
    const seqB = ++seq;

    // B completes first
    applyOpenResult(seq, seqB, 'body-B', state);
    assert.equal(state.body, 'body-B');

    // Stale A completes later
    applyOpenResult(seq, seqA, 'body-A', state);
    assert.equal(state.body, 'body-B');
    assert.equal(state.seq, seqB);
  });
});
