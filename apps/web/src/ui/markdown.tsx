import type { ReactNode } from 'react';

/**
 * Lightweight Markdown → React (no deps).
 * Supports: ATX headings h1–h3, fenced code, unordered lists,
 * paragraphs, **bold**, *italic*, `code`, [text](url).
 */

function isSafeHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith('/') && !t.startsWith('//')) return true;
  if (t.startsWith('#')) return true;
  return false;
}

/** Inline: bold, italic, code, links. Order matters. */
export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  // code | bold | italic | link | plain
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c-${k++}`}>{token.slice(1, -1)}</code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${k++}`}>
          {renderInline(token.slice(2, -2), `${keyPrefix}-b${k}`)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={`${keyPrefix}-e-${k++}`}>
          {renderInline(token.slice(1, -1), `${keyPrefix}-e${k}`)}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (lm) {
        const label = lm[1];
        const href = lm[2].trim();
        if (isSafeHref(href)) {
          nodes.push(
            <a
              key={`${keyPrefix}-a-${k++}`}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noreferrer noopener' : undefined}
            >
              {label}
            </a>,
          );
        } else {
          nodes.push(label);
        }
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string }
  | { type: 'empty' };

export function parseMarkdownBlocks(source: string): Block[] {
  if (!source) return [];
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
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        body.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1; // closing fence
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
      blocks.push({ type: 'list', items });
      continue;
    }

    // paragraph: merge until blank / special
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i]!) &&
      !/^[-*]\s+/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }
  return blocks;
}

export type OutlineItem = {
  /** Stable id matching MarkdownView heading anchors. */
  id: string;
  level: 1 | 2 | 3;
  text: string;
  /** 0-based line index in source (for editor jump). */
  line: number;
};

export function headingAnchorId(index: number): string {
  return `md-h-${index}`;
}

/**
 * Extract h1–h3 outline; skips fenced code so `#` inside fences is ignored.
 */
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
    const hm = /^(#{1,3})\s+(.+)$/.exec(line);
    if (!hm) continue;
    items.push({
      id: headingAnchorId(n),
      level: hm[1]!.length as 1 | 2 | 3,
      text: hm[2]!.trim(),
      line: i,
    });
    n += 1;
  }
  return items;
}

/** Place caret at start of 0-based line in a textarea. */
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
  // Approximate scroll: ratio of line / total lines
  const ratio = lines.length > 1 ? max / (lines.length - 1) : 0;
  el.scrollTop = Math.max(
    0,
    ratio * (el.scrollHeight - el.clientHeight) - el.clientHeight * 0.2,
  );
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

  const blocks = parseMarkdownBlocks(source);
  let headingIndex = 0;
  return (
    <div className={className ?? 'md-preview'}>
      {blocks.map((b, idx) => {
        if (b.type === 'empty') return null;
        if (b.type === 'heading') {
          const id = headingAnchorId(headingIndex++);
          if (b.level === 1) {
            return (
              <h1 key={idx} id={id}>
                {renderInline(b.text, `h1-${idx}`)}
              </h1>
            );
          }
          if (b.level === 2) {
            return (
              <h2 key={idx} id={id}>
                {renderInline(b.text, `h2-${idx}`)}
              </h2>
            );
          }
          return (
            <h3 key={idx} id={id}>
              {renderInline(b.text, `h3-${idx}`)}
            </h3>
          );
        }
        if (b.type === 'code') {
          return (
            <pre key={idx} className="md-code" data-lang={b.lang || undefined}>
              <code>{b.body}</code>
            </pre>
          );
        }
        if (b.type === 'list') {
          return (
            <ul key={idx}>
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item, `li-${idx}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx}>{renderInline(b.text, `p-${idx}`)}</p>
        );
      })}
    </div>
  );
}

/** Test helper: extract plain text structure description. */
export function describeBlocks(source: string): string[] {
  return parseMarkdownBlocks(source).map((b) => {
    if (b.type === 'heading') return `h${b.level}:${b.text}`;
    if (b.type === 'code') return `code:${b.lang}:${b.body}`;
    if (b.type === 'list') return `list:${b.items.join('|')}`;
    if (b.type === 'paragraph') return `p:${b.text}`;
    return 'empty';
  });
}
