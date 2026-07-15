import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeBlocks,
  extractOutline,
  headingAnchorId,
  parseMarkdownBlocks,
} from './markdown';

describe('parseMarkdownBlocks', () => {
  it('parses headings lists code and paragraphs', () => {
    const src = `# Title

Intro **bold** and *em* and \`code\`.

## Sub

- one
- two

\`\`\`ts
const x = 1;
\`\`\`

[link](https://example.com)
`;
    const d = describeBlocks(src);
    assert.equal(d[0], 'h1:Title');
    assert.ok(d.some((x) => x.startsWith('p:Intro')));
    assert.ok(d.some((x) => x === 'h2:Sub'));
    assert.ok(d.some((x) => x === 'list:one|two'));
    assert.ok(d.some((x) => x.startsWith('code:ts:')));
    assert.ok(d.some((x) => x.includes('[link](https://example.com)')));
  });

  it('handles empty and bare text', () => {
    assert.deepEqual(describeBlocks(''), []);
    assert.deepEqual(describeBlocks('hello'), ['p:hello']);
  });

  it('does not treat unclosed fence as infinite', () => {
    const blocks = parseMarkdownBlocks('```\ncode only');
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.type, 'code');
    if (blocks[0]?.type === 'code') {
      assert.equal(blocks[0].body, 'code only');
    }
  });
});

describe('extractOutline', () => {
  it('lists headings with ids and lines', () => {
    const src = `# A\n\npara\n\n## B\n\n### C\n`;
    const o = extractOutline(src);
    assert.equal(o.length, 3);
    assert.deepEqual(
      o.map((x) => ({ id: x.id, level: x.level, text: x.text, line: x.line })),
      [
        { id: headingAnchorId(0), level: 1, text: 'A', line: 0 },
        { id: headingAnchorId(1), level: 2, text: 'B', line: 4 },
        { id: headingAnchorId(2), level: 3, text: 'C', line: 6 },
      ],
    );
  });

  it('skips headings inside fenced code', () => {
    const src = `# Real\n\`\`\`\n# Fake\n\`\`\`\n## Also\n`;
    const o = extractOutline(src);
    assert.equal(o.length, 2);
    assert.equal(o[0]?.text, 'Real');
    assert.equal(o[1]?.text, 'Also');
  });

  it('empty source', () => {
    assert.deepEqual(extractOutline(''), []);
  });
});
