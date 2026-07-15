import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

/**
 * Markdown rendering via react-markdown + remark-gfm + rehype-sanitize.
 * Outline extraction stays lightweight (line-oriented, fence-aware).
 */

export type OutlineItem = {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
};

export function headingAnchorId(index: number): string {
  return `md-h-${index}`;
}

/** Extract H1–H6 for outline; skips fenced code blocks. */
export function extractOutline(source: string): OutlineItem[] {
  if (!source) return [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const items: OutlineItem[] = [];
  let inFence = false;
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const hm = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!hm) continue;
    items.push({
      id: headingAnchorId(n),
      level: hm[1]!.length as OutlineItem['level'],
      text: hm[2]!.trim(),
      line: i,
    });
    n += 1;
  }
  return items;
}

export function focusTextareaLine(
  el: HTMLTextAreaElement,
  line: number,
): void {
  const lines = el.value.replace(/\r\n/g, '\n').split('\n');
  let pos = 0;
  const max = Math.min(Math.max(0, line), lines.length);
  for (let i = 0; i < max; i++) {
    pos += (lines[i]?.length ?? 0) + 1;
  }
  el.focus();
  el.setSelectionRange(pos, pos);
  const ratio = lines.length > 1 ? max / (lines.length - 1) : 0;
  el.scrollTop = Math.max(
    0,
    ratio * (el.scrollHeight - el.clientHeight) - el.clientHeight * 0.2,
  );
}

/** Scroll CodeMirror-like content or preview to a 0-based line. */
export function scrollPreviewToHeading(
  root: HTMLElement | null,
  headingId: string,
): void {
  if (!root) return;
  const el = root.querySelector(`#${CSS.escape(headingId)}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildHeadingComponents(startIndex: { n: number }): Components {
  const wrap =
    (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ children, ...props }: any) => {
      const id = headingAnchorId(startIndex.n++);
      return (
        <Tag id={id} {...props}>
          {children}
        </Tag>
      );
    };
  return {
    h1: wrap('h1'),
    h2: wrap('h2'),
    h3: wrap('h3'),
    h4: wrap('h4'),
    h5: wrap('h5'),
    h6: wrap('h6'),
  };
}

export function MarkdownView({
  source,
  className,
  emptyLabel = '（空文档）',
}: {
  source: string;
  className?: string;
  emptyLabel?: string;
}) {
  const trimmed = source.trim();
  if (!trimmed) {
    return (
      <div className={className ?? 'md-preview'}>
        <p className="muted">{emptyLabel}</p>
      </div>
    );
  }

  const counter = { n: 0 };
  const components = buildHeadingComponents(counter);

  return (
    <div className={className ?? 'md-preview'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

/** @deprecated Kept for unit tests of outline / legacy describe — not used for UI. */
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string }
  | { type: 'empty' };

/**
 * Minimal block scanner for unit tests only.
 * Production preview uses react-markdown.
 */
export function parseMarkdownBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      blocks.push({ type: 'empty' });
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, body: body.join('\n') });
      continue;
    }
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hm) {
      blocks.push({
        type: 'heading',
        level: hm[1]!.length as 1 | 2 | 3,
        text: hm[2]!.trim(),
      });
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }
    if (line.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) {
        q.push(lines[i]!.replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: q });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]!)
    ) {
      const header = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes('|')) {
        rows.push(
          lines[i]!
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim()),
        );
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i]!.trim() !== '') {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }
  return blocks;
}

export function describeBlocks(source: string): string[] {
  return parseMarkdownBlocks(source)
    .filter((b) => b.type !== 'empty')
    .map((b) => {
      if (b.type === 'heading') return `h${b.level}:${b.text}`;
      if (b.type === 'code') return `code:${b.lang}:${b.body.slice(0, 20)}`;
      if (b.type === 'list') {
        return `${b.ordered ? 'ol' : 'ul'}:${b.items.join('|')}`;
      }
      if (b.type === 'blockquote') return `quote:${b.lines.join(' ')}`;
      if (b.type === 'table') {
        return `table:${b.header.join(',')};${b.rows.map((r) => r.join(',')).join(';')}`;
      }
      if (b.type === 'hr') return 'hr';
      if (b.type === 'paragraph') return `p:${b.text}`;
      return 'empty';
    });
}
