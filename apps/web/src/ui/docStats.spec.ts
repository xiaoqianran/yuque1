import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDocStats,
  formatDocStats,
  sanitizeDownloadFilename,
} from './docStats';

describe('computeDocStats', () => {
  it('empty', () => {
    assert.deepEqual(computeDocStats(''), {
      chars: 0,
      charsNoSpace: 0,
      lines: 0,
      words: 0,
    });
  });

  it('counts latin words and lines', () => {
    const s = computeDocStats('hello world\n\nfoo');
    assert.equal(s.chars, 'hello world\n\nfoo'.length);
    assert.equal(s.charsNoSpace, 'helloworldfoo'.length);
    assert.equal(s.lines, 3);
    assert.equal(s.words, 3);
  });

  it('counts CJK characters as words', () => {
    const s = computeDocStats('你好世界');
    assert.equal(s.charsNoSpace, 4);
    assert.equal(s.words, 4);
    assert.equal(s.lines, 1);
  });
});

describe('formatDocStats', () => {
  it('formats label', () => {
    assert.equal(
      formatDocStats({ chars: 10, charsNoSpace: 8, lines: 2, words: 3 }),
      '8 字 · 3 词 · 2 行',
    );
  });
});

describe('sanitizeDownloadFilename', () => {
  it('strips illegal path chars and limits length', () => {
    assert.equal(sanitizeDownloadFilename('  a/b:c*d  '), 'a_b_c_d');
    assert.equal(sanitizeDownloadFilename(''), 'untitled');
    assert.equal(sanitizeDownloadFilename('x.md'), 'x');
    assert.ok(sanitizeDownloadFilename('y'.repeat(100)).length <= 80);
  });
});
