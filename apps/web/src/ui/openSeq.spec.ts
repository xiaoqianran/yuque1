import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenSequence, shouldApplyOpenResult } from './openSeq';

describe('OpenSequence (shipped race gate)', () => {
  it('only the latest open may apply results', async () => {
    const gate = new OpenSequence();
    const seqA = gate.next();
    const seqB = gate.next();

    // B completes first
    assert.equal(gate.isCurrent(seqB), true);
    assert.equal(shouldApplyOpenResult(gate.current(), seqB), true);

    // Stale A must not apply
    assert.equal(gate.isCurrent(seqA), false);
    assert.equal(shouldApplyOpenResult(gate.current(), seqA), false);
  });

  it('simulates delayed content loads against the real gate', async () => {
    const gate = new OpenSequence();
    let body = '';

    async function openDoc(id: string, delayMs: number, payload: string) {
      const seq = gate.next();
      await new Promise((r) => setTimeout(r, delayMs));
      if (!gate.isCurrent(seq)) return;
      body = payload;
    }

    // Start A (slow) then B (fast)
    const pA = openDoc('a', 40, 'body-A');
    const pB = openDoc('b', 5, 'body-B');
    await Promise.all([pA, pB]);

    assert.equal(body, 'body-B');
  });
});
