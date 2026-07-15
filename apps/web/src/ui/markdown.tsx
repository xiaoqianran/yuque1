import type { ReactNode } from 'react';

/**
 * Lightweight Markdown → React (no deps).
 * Supports: ATX h1–h3, fenced code, ul/ol, blockquote, GFM tables,
 * hr, paragraphs, **bold**, *italic*, `code`, [text](url).
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

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; lang: string; body: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'paragraph'; text: string }
  | { type: 'empty' };

function isTableSep(line: string): boolean {
  // | --- | :---: | ---: |
  const t = line.trim();
  if (!t.includes('|')) return false;
  const cells = t
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function parseTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function isSpecialStart(line: string): boolean {
  if (line.startsWith('```')) return true;
  if (/^(#{1,3})\s+/.test(line)) return true;
  if (/^[-*]\s+/.test(line)) return true;
  if (/^\d+\.\s+/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) return true;
  if (line.includes('|') && isTableSep(line)) return true;
  return false;
}

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
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, body: body.join('\n') });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i += 1;
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

    // GFM table: header + separator + rows
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSep(lines[i + 1]!)
    ) {
      const header = parseTableRow(line);
      i += 2; // skip header + sep
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.includes('|')) {
        if (isTableSep(lines[i]!)) {
          i += 1;
          continue;
        }
        rows.push(parseTableRow(lines[i]!));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const qlines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        qlines.push(lines[i]!.replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: qlines });
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

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !isSpecialStart(lines[i]!) &&
      !(
        lines[i]!.includes('|') &&
        i + 1 < lines.length &&
        isTableSep(lines[i + 1]!)
      )
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: para.join('\n') });
  }
  return blocks;
}

export type OutlineItem = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  line: number;
};

export function headingAnchorId(index: number): string {
  return `md-h-${index}`;
}

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
        if (b.type === 'hr') {
          return <hr key={idx} className="md-hr" />;
        }
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
          const Tag = b.ordered ? 'ol' : 'ul';
          return (
            <Tag key={idx}>
              {b.items.map((item, j) => (
                <li key={j}>{renderInline(item, `li-${idx}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        if (b.type === 'blockquote') {
          return (
            <blockquote key={idx} className="md-quote">
              {b.lines.map((ln, j) => (
                <p key={j}>{renderInline(ln, `q-${idx}-${j}`)}</p>
              ))}
            </blockquote>
          );
        }
        if (b.type === 'table') {
          return (
            <div key={idx} className="md-table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    {b.header.map((cell, j) => (
                      <th key={j}>{renderInline(cell, `th-${idx}-${j}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, j) => (
                        <td key={j}>
                          {renderInline(cell, `td-${idx}-${r}-${j}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={idx}>{renderInline(b.text, `p-${idx}`)}</p>;
      })}
    </div>
  );
}

/** Test helper: extract plain text structure description. */
export function describeBlocks(source: string): string[] {
  return parseMarkdownBlocks(source).map((b) => {
    if (b.type === 'heading') return `h${b.level}:${b.text}`;
    if (b.type === 'code') return `code:${b.lang}:${b.body}`;
    if (b.type === 'list') {
      return `${b.ordered ? 'ol' : 'ul'}:${b.items.join('|')}`;
    }
    if (b.type === 'blockquote') return `quote:${b.lines.join('/')}`;
    if (b.type === 'table') {
      return `table:${b.header.join(',')};${b.rows.map((r) => r.join(',')).join(';')}`;
    }
    if (b.type === 'hr') return 'hr';
    if (b.type === 'paragraph') return `p:${b.text}`;
    return 'empty';
  });
}
