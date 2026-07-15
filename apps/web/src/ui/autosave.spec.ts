import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTOSAVE_DEBOUNCE_MS,
  autosaveStatusLabel,
  canAutosave,
  isDirty,
} from './autosave';

describe('canAutosave', () => {
  const base = {
    hasDoc: true,
    version: 2,
    body: 'hello',
    lastSavedBody: 'old',
    hasConflict: false,
    isSaving: false,
    canWrite: true,
  };

  it('allows when dirty and ready', () => {
    assert.deepEqual(canAutosave(base), { allow: true });
  });

  it('blocks on conflict', () => {
    const r = canAutosave({ ...base, hasConflict: true });
    assert.equal(r.allow, false);
    if (!r.allow) assert.equal(r.reason, 'conflict');
  });

  it('blocks when clean', () => {
    const r = canAutosave({ ...base, body: 'old', lastSavedBody: 'old' });
    assert.equal(r.allow, false);
    if (!r.allow) assert.equal(r.reason, 'clean');
  });

  it('blocks while saving / no version / readonly', () => {
    assert.equal(canAutosave({ ...base, isSaving: true }).allow, false);
    assert.equal(canAutosave({ ...base, version: null }).allow, false);
    assert.equal(canAutosave({ ...base, canWrite: false }).allow, false);
    assert.equal(canAutosave({ ...base, hasDoc: false }).allow, false);
  });
});

describe('isDirty / status', () => {
  it('isDirty', () => {
    assert.equal(isDirty('a', null), false);
    assert.equal(isDirty('a', 'a'), false);
    assert.equal(isDirty('b', 'a'), true);
  });

  it('autosaveStatusLabel', () => {
    assert.equal(
      autosaveStatusLabel({
        isSaving: true,
        isDirty: true,
        lastAuto: false,
        version: 1,
      }),
      '自动保存中…',
    );
    assert.equal(
      autosaveStatusLabel({
        isSaving: false,
        isDirty: true,
        lastAuto: false,
        version: 1,
      }),
      '未保存',
    );
    assert.equal(
      autosaveStatusLabel({
        isSaving: false,
        isDirty: false,
        lastAuto: true,
        version: 3,
      }),
      '已自动保存 v3',
    );
  });

  it('debounce constant is positive', () => {
    assert.ok(AUTOSAVE_DEBOUNCE_MS >= 500);
  });
});
