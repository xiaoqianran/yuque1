import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  lastOpenedStorageKey,
  loadLastOpenedDocId,
  saveLastOpenedDocId,
} from './lastOpenedDoc';

describe('lastOpenedDoc', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
  });

  it('round-trips last opened id', () => {
    assert.equal(loadLastOpenedDocId('kb1'), null);
    saveLastOpenedDocId('kb1', 'doc-a');
    assert.equal(loadLastOpenedDocId('kb1'), 'doc-a');
    assert.equal(store.get(lastOpenedStorageKey('kb1')), 'doc-a');
    saveLastOpenedDocId('kb1', null);
    assert.equal(loadLastOpenedDocId('kb1'), null);
  });
});
