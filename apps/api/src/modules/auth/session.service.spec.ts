import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKvStore } from '../kv/memory-kv.store';
import { SessionService } from './session.service';

describe('SessionService', () => {
  let sessions: SessionService;

  beforeEach(() => {
    sessions = new SessionService(new MemoryKvStore());
  });

  it('creates and resolves session', async () => {
    const sid = await sessions.create('user-1');
    assert.ok(sid.length > 10);
    const s = await sessions.get(sid);
    assert.equal(s?.userId, 'user-1');
    await sessions.destroy(sid);
    assert.equal(await sessions.get(sid), null);
  });
});
