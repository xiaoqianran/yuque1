import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUpdatedAt,
  resolveViewPhase,
  roleLabel,
  statePanelClass,
} from './viewState';

describe('resolveViewPhase', () => {
  it('prefers loading over error and empty', () => {
    assert.equal(
      resolveViewPhase({ loading: true, error: 'x', isEmpty: true }),
      'loading',
    );
  });

  it('prefers error over empty', () => {
    assert.equal(
      resolveViewPhase({ loading: false, error: 'boom', isEmpty: true }),
      'error',
    );
  });

  it('returns empty when no error and no items', () => {
    assert.equal(
      resolveViewPhase({ loading: false, error: null, isEmpty: true }),
      'empty',
    );
  });

  it('returns ready when content present', () => {
    assert.equal(
      resolveViewPhase({ loading: false, error: null, isEmpty: false }),
      'ready',
    );
  });
});

describe('statePanelClass', () => {
  it('maps phase to BEM modifier class', () => {
    assert.equal(statePanelClass('loading'), 'state-panel state-panel--loading');
    assert.equal(statePanelClass('error'), 'state-panel state-panel--error');
    assert.equal(statePanelClass('empty'), 'state-panel state-panel--empty');
    assert.equal(statePanelClass('ready'), 'state-panel state-panel--ready');
  });
});

describe('roleLabel', () => {
  it('localizes known roles', () => {
    assert.equal(roleLabel('owner'), '所有者');
    assert.equal(roleLabel('editor'), '可编辑');
    assert.equal(roleLabel('reader'), '只读');
  });

  it('passes through unknown roles', () => {
    assert.equal(roleLabel('admin'), 'admin');
  });
});

describe('formatUpdatedAt', () => {
  it('formats valid ISO timestamps', () => {
    const s = formatUpdatedAt('2026-01-15T12:00:00.000Z');
    assert.ok(s.length > 0);
    assert.equal(formatUpdatedAt(null), '');
    assert.equal(formatUpdatedAt('not-a-date'), '');
  });
});
