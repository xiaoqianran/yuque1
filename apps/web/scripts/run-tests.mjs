import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = globSync('src/**/*.spec.ts', { cwd: root }).sort();
if (files.length === 0) {
  console.error('No spec files found under src/');
  process.exit(1);
}
const r = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...files],
  { cwd: root, stdio: 'inherit' },
);
process.exit(r.status ?? 1);
