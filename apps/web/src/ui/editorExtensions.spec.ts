import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarkdownEditorExtensions,
  editorSearchFeatures,
} from './editorExtensions';

describe('buildMarkdownEditorExtensions', () => {
  it('returns a non-empty extension list including search stack', () => {
    const ext = buildMarkdownEditorExtensions({ readOnly: false });
    assert.ok(Array.isArray(ext));
    assert.ok(ext.length >= 5);
  });

  it('builds extensions for readonly mode', () => {
    const ext = buildMarkdownEditorExtensions({ readOnly: true });
    assert.ok(ext.length >= 5);
  });
});

describe('editorSearchFeatures', () => {
  it('documents shipped search capabilities', () => {
    const f = editorSearchFeatures();
    assert.ok(f.includes('search'));
    assert.ok(f.includes('searchKeymap'));
    assert.ok(f.includes('Mod-f'));
  });
});
