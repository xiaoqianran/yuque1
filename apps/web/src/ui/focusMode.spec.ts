import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isExitFocusKey, isToggleFocusShortcut } from './focusMode';

describe('focusMode shortcuts', () => {
  it('detects Ctrl/Cmd+Shift+F', () => {
    assert.equal(
      isToggleFocusShortcut({
        key: 'f',
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
      }),
      true,
    );
    assert.equal(
      isToggleFocusShortcut({
        key: 'F',
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
      }),
      true,
    );
    assert.equal(
      isToggleFocusShortcut({
        key: 'f',
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
      }),
      false,
    );
  });

  it('detects Escape', () => {
    assert.equal(isExitFocusKey({ key: 'Escape' }), true);
    assert.equal(isExitFocusKey({ key: 'Esc' }), true);
    assert.equal(isExitFocusKey({ key: 'Enter' }), false);
  });
});
