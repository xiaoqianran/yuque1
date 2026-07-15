import { strFromU8, unzipSync } from 'fflate';
import type { ZipFileEntry } from './exportKbZip';
import { sanitizePathSegment } from './exportKbZip';

export const IMPORT_ZIP_MAX_BYTES = 20 * 1024 * 1024;
export const IMPORT_ZIP_MAX_FILES = 500;

export type ZipImportFolderOp = {
  kind: 'folder';
  /** Unique key for this folder path, e.g. `指南/子夹` */
  pathKey: string;
  title: string;
  parentPathKey: string | null;
};

export type ZipImportDocOp = {
  kind: 'doc';
  pathKey: string;
  title: string;
  parentPathKey: string | null;
  body: string;
};

export type ZipImportOp = ZipImportFolderOp | ZipImportDocOp;

export type ZipImportPlan =
  | { ok: true; ops: ZipImportOp[]; docCount: number; folderCount: number }
  | { ok: false; message: string };

/** Normalize zip entry path: strip leading slashes, use `/`. */
export function normalizeZipPath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
    .trim();
}

export function isIgnoredZipPath(path: string): boolean {
  const p = normalizeZipPath(path);
  if (!p) return true;
  if (p.startsWith('__MACOSX/')) return true;
  if (p.endsWith('/')) return true; // directory markers
  const base = p.split('/').pop() ?? '';
  if (base === '.DS_Store') return true;
  if (base === '.yuque1-export-empty') return true;
  if (base.startsWith('.')) return true;
  return false;
}

export function isMarkdownZipPath(path: string): boolean {
  return /\.(md|markdown|txt)$/i.test(path);
}

/**
 * Parse ZIP bytes into markdown file entries (path + utf-8 body).
 */
export function parseMarkdownZip(
  bytes: Uint8Array,
): { ok: true; files: ZipFileEntry[] } | { ok: false; message: string } {
  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(bytes);
  } catch {
    return { ok: false, message: '无法解析 ZIP 文件' };
  }
  const files: ZipFileEntry[] = [];
  for (const [rawPath, data] of Object.entries(unpacked)) {
    const path = normalizeZipPath(rawPath);
    if (isIgnoredZipPath(path)) continue;
    if (!isMarkdownZipPath(path)) continue;
    let body: string;
    try {
      body = strFromU8(data);
    } catch {
      body = '';
    }
    files.push({ path, body });
  }
  if (files.length === 0) {
    return { ok: false, message: 'ZIP 中未找到 .md / .markdown / .txt 文档' };
  }
  if (files.length > IMPORT_ZIP_MAX_FILES) {
    return {
      ok: false,
      message: `文档过多（最多 ${IMPORT_ZIP_MAX_FILES} 篇）`,
    };
  }
  return { ok: true, files };
}

/**
 * Turn zip markdown paths into ordered create operations:
 * folders first (by depth), then docs. Path keys use sanitized segments.
 */
export function planZipImport(files: ZipFileEntry[]): ZipImportPlan {
  if (files.length === 0) {
    return { ok: false, message: '没有可导入的文档' };
  }

  type DocSpec = { segments: string[]; body: string };
  const docs: DocSpec[] = [];
  for (const f of files) {
    const parts = normalizeZipPath(f.path)
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    const fileName = parts[parts.length - 1]!;
    if (!isMarkdownZipPath(fileName)) continue;
    const stem = fileName.replace(/\.(md|markdown|txt)$/i, '').trim() || '导入文档';
    const dirSegs = parts.slice(0, -1).map(sanitizePathSegment);
    const title = sanitizePathSegment(stem).slice(0, 512) || '导入文档';
    docs.push({ segments: [...dirSegs, title], body: f.body });
  }
  if (docs.length === 0) {
    return { ok: false, message: 'ZIP 中未找到有效 Markdown 路径' };
  }

  const folderKeys = new Map<string, { title: string; parent: string | null }>();
  for (const d of docs) {
    // all but last segment are folders
    for (let i = 0; i < d.segments.length - 1; i++) {
      const segs = d.segments.slice(0, i + 1);
      const pathKey = segs.join('/');
      const parent = i === 0 ? null : segs.slice(0, i).join('/');
      if (!folderKeys.has(pathKey)) {
        folderKeys.set(pathKey, { title: segs[i]!, parent });
      }
    }
  }

  // folders sorted by depth
  const folderOps: ZipImportFolderOp[] = [...folderKeys.entries()]
    .map(([pathKey, v]) => ({
      kind: 'folder' as const,
      pathKey,
      title: v.title,
      parentPathKey: v.parent,
    }))
    .sort(
      (a, b) =>
        a.pathKey.split('/').length - b.pathKey.split('/').length ||
        a.pathKey.localeCompare(b.pathKey),
    );

  const docOps: ZipImportDocOp[] = docs.map((d) => {
    const title = d.segments[d.segments.length - 1]!;
    const parentSegs = d.segments.slice(0, -1);
    const parentPathKey = parentSegs.length ? parentSegs.join('/') : null;
    const pathKey = d.segments.join('/');
    return {
      kind: 'doc',
      pathKey,
      title,
      parentPathKey,
      body: d.body,
    };
  });

  const ops: ZipImportOp[] = [...folderOps, ...docOps];
  return {
    ok: true,
    ops,
    docCount: docOps.length,
    folderCount: folderOps.length,
  };
}

export function validateImportZipFile(file: {
  name: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  if (!file.name || !/\.zip$/i.test(file.name)) {
    return { ok: false, message: '请选择 .zip 文件' };
  }
  if (file.size <= 0) {
    return { ok: false, message: '文件为空' };
  }
  if (file.size > IMPORT_ZIP_MAX_BYTES) {
    return {
      ok: false,
      message: `ZIP 超过 ${Math.floor(IMPORT_ZIP_MAX_BYTES / 1024 / 1024)}MB 限制`,
    };
  }
  return { ok: true };
}

export async function readFileAsUint8Array(file: Blob): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}
