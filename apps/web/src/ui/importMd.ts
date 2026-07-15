/** Markdown import helpers (file validation + title from filename). */

export const IMPORT_MD_MAX_BYTES = 2 * 1024 * 1024; // align with API body limit

const ALLOWED_EXT = /\.(md|markdown|txt)$/i;
const ALLOWED_MIME = new Set([
  'text/markdown',
  'text/plain',
  'text/x-markdown',
  'application/octet-stream', // browsers often use this for .md
  '',
]);

export function titleFromFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const noExt = base.replace(/\.(md|markdown|txt)$/i, '').trim();
  return noExt.slice(0, 512) || '导入文档';
}

export type FileValidation =
  | { ok: true; title: string }
  | { ok: false; message: string };

export function validateImportFile(
  file: { name: string; size: number; type: string },
  maxBytes: number = IMPORT_MD_MAX_BYTES,
): FileValidation {
  if (!file.name || !ALLOWED_EXT.test(file.name)) {
    return { ok: false, message: '仅支持 .md / .markdown / .txt 文件' };
  }
  const mime = (file.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime) && !mime.startsWith('text/')) {
    return { ok: false, message: '文件类型不受支持' };
  }
  if (file.size <= 0) {
    return { ok: false, message: '文件为空' };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `文件超过 ${Math.floor(maxBytes / 1024 / 1024)}MB 限制`,
    };
  }
  return { ok: true, title: titleFromFilename(file.name) };
}

export async function readFileAsText(file: Blob): Promise<string> {
  return file.text();
}
