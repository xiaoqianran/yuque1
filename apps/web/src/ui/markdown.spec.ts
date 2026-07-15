import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { describeBlocks, parseMarkdownBlocks } from './markdown';

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
