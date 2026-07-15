import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from './markdown';

/** Render the shipped MarkdownView (react-markdown pipeline), not a parallel parser. */
function renderMd(source: string): string {
  return renderToStaticMarkup(
    createElement(MarkdownView, { source, className: 'ws-preview' }),
  );
}

describe('MarkdownView GFM render (shipped preview path)', () => {
  it('renders GFM table, task list, blockquote, image, and fenced code', () => {
    const src = `# Doc

- [ ] todo item
- [x] done item

| Col | Val |
| --- | --- |
| a | 1 |

> quote line

![alt text](https://example.com/x.png)

\`\`\`js
console.log(1)
\`\`\`
`;
    const html = renderMd(src);

    assert.match(html, /<table[\s>]/i, 'table');
    assert.match(html, /<th[\s>]/i, 'th');
    assert.match(html, /<td[\s>]/i, 'td');
    assert.match(html, /todo item/, 'task text');
    // remark-gfm task lists render as input checkbox inside li
    assert.match(html, /type="checkbox"|checkbox/i, 'task checkbox');
    assert.match(html, /<blockquote[\s>]/i, 'blockquote');
    assert.match(html, /quote line/, 'blockquote text');
    assert.match(html, /<img[\s>]/i, 'img');
    assert.match(html, /example\.com\/x\.png/, 'img src');
    assert.match(html, /<pre[\s>]/i, 'pre');
    assert.match(html, /console\.log/, 'code body');
  });

  it('renders ordered and unordered lists and emphasis', () => {
    const html = renderMd(`1. first\n2. second\n\n- bullet\n\n**bold** and *em*`);
    assert.match(html, /<ol[\s>]/i);
    assert.match(html, /<ul[\s>]/i);
    assert.match(html, /<strong[\s>]|>bold</i);
    assert.match(html, /<em[\s>]|>em</i);
  });

  it('empty source shows empty label', () => {
    const html = renderMd('   ');
    assert.match(html, /空文档/);
  });
});
