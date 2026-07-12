import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Load KEY=VALUE files into process.env (does not override existing keys).
 * Used by Nest bootstrap so runtime matches Prisma CLI env loading.
 */
export function loadEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return true;
}

/** Candidate .env paths for monorepo (cwd may be root or apps/api; __dirname may be src/dist). */
export function resolveEnvCandidates(cwd = process.cwd(), baseDir = __dirname): string[] {
  return [
    resolve(cwd, '.env'),
    resolve(cwd, 'apps/api/.env'),
    resolve(cwd, '../../.env'),
    resolve(baseDir, '../.env'),
    resolve(baseDir, '../../.env'),
    resolve(baseDir, '../../../.env'),
    resolve(dirname(baseDir), '.env'),
  ];
}

export function loadMonorepoEnv(cwd = process.cwd(), baseDir = __dirname): string[] {
  const loaded: string[] = [];
  const seen = new Set<string>();
  for (const p of resolveEnvCandidates(cwd, baseDir)) {
    const abs = resolve(p);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (loadEnvFile(abs)) loaded.push(abs);
  }
  return loaded;
}
