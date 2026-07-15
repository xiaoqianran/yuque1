/** Document body statistics and Markdown download helpers. */

export type DocStats = {
  /** Total UTF-16 code units (string length). */
  chars: number;
  /** Non-whitespace characters. */
  charsNoSpace: number;
  /** Non-empty logical lines (split by \\n). Empty body → 0. */
  lines: number;
  /**
   * Rough word count: whitespace-separated tokens;
   * continuous CJK runs count as one word each character group is 1 token already.
   */
  words: number;
};

export function computeDocStats(body: string): DocStats {
  const chars = body.length;
  const charsNoSpace = body.replace(/\s/g, '').length;
  if (body.length === 0) {
    return { chars: 0, charsNoSpace: 0, lines: 0, words: 0 };
  }
  const lines = body.replace(/\r\n/g, '\n').split('\n').length;
  // Split on whitespace; CJK text without spaces becomes one "word" — also
  // count CJK code points as separate words when adjacent to Latin via regex.
  const tokens = body
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((tok) => {
      // Split Latin vs CJK runs
      return tok.match(/[\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+/g) ?? [
        tok,
      ];
    })
    .flatMap((tok) => {
      // Each CJK char is one word; Latin runs stay one word
      if (/^[\u4e00-\u9fff\u3400-\u4dbf]+$/.test(tok)) {
        return [...tok];
      }
      return [tok];
    });
  return {
    chars,
    charsNoSpace,
    lines,
    words: body.trim() ? tokens.length : 0,
  };
}

export function formatDocStats(s: DocStats): string {
  return `${s.charsNoSpace} 字 · ${s.words} 词 · ${s.lines} 行`;
}

/** Safe single-segment filename stem from document title. */
export function sanitizeDownloadFilename(title: string): string {
  const t = title.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ');
  const base = t.slice(0, 80) || 'untitled';
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

/**
 * Trigger browser download of Markdown content.
 * Uses Blob + object URL (revoked after click).
 */
export function downloadMarkdownFile(title: string, body: string): void {
  const name = `${sanitizeDownloadFilename(title)}.md`;
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
