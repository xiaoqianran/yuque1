import { zipSync, strToU8 } from 'fflate';
import type { PublicNode } from '../api/types';
import { buildChildrenMap } from './treeOps';
import { sanitizeDownloadFilename } from './docStats';

/** One file entry inside the export archive. */
export type ZipFileEntry = {
  /** Path relative to archive root, uses `/` separators. */
  path: string;
  body: string;
};

/**
 * Sanitize a single path segment (folder or file stem).
 * Avoids empty names and path separators.
 */
export function sanitizePathSegment(raw: string): string {
  const t = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 80);
  return t || 'untitled';
}

/**
 * Build unique relative .md paths for every doc in the tree.
 * Folders become path prefixes; empty folders produce no files.
 * Sibling title collisions get ` (2)`, ` (3)`, … before `.md`.
 */
export function buildDocExportPaths(
  nodes: PublicNode[],
): { nodeId: string; path: string }[] {
  const childMap = buildChildrenMap(nodes);
  const out: { nodeId: string; path: string }[] = [];

  function walk(parentId: string | null, prefix: string) {
    const kids = childMap.get(parentId) ?? [];
    const used = new Set<string>();
    for (const n of kids) {
      const seg = sanitizePathSegment(n.title);
      if (n.type === 'folder') {
        const folderName = uniqueName(seg, used, false);
        used.add(folderName.toLowerCase());
        const next = prefix ? `${prefix}/${folderName}` : folderName;
        walk(n.id, next);
      } else {
        const fileStem = uniqueName(seg, used, true);
        used.add(fileStem.toLowerCase());
        const path = prefix ? `${prefix}/${fileStem}.md` : `${fileStem}.md`;
        out.push({ nodeId: n.id, path });
      }
    }
  }

  walk(null, '');
  return out;
}

function uniqueName(
  base: string,
  used: Set<string>,
  _isFile: boolean,
): string {
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base} (${i})`;
    i += 1;
  }
  return name;
}

/** Build a ZIP Uint8Array from path → body pairs. */
export function buildMarkdownZip(files: ZipFileEntry[]): Uint8Array {
  const data: Record<string, Uint8Array> = {};
  for (const f of files) {
    const path = f.path.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!path) continue;
    data[path] = strToU8(f.body);
  }
  if (Object.keys(data).length === 0) {
    // Valid empty archive marker so download still works
    data['.yuque1-export-empty'] = strToU8(
      'No documents in this knowledge base.\n',
    );
  }
  return zipSync(data, { level: 6 });
}

/** Trigger browser download of a binary ZIP. */
export function downloadZipFile(filenameStem: string, zipBytes: Uint8Array): void {
  const name = `${sanitizeDownloadFilename(filenameStem)}.zip`;
  // Copy into a fresh ArrayBuffer-backed Uint8Array for BlobPart typing
  const copy = new Uint8Array(zipBytes.byteLength);
  copy.set(zipBytes);
  const blob = new Blob([copy.buffer], { type: 'application/zip' });
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
