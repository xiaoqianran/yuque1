#!/usr/bin/env node
/**
 * Lightweight docs / repo health checks for CI.
 * Fails on missing required paths when they are expected, and on empty markdown files.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const requiredRootFiles = ['README.md', 'package.json', '.nvmrc'];

let failed = false;

function fail(msg) {
  console.error(`✖ ${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`✔ ${msg}`);
}

for (const f of requiredRootFiles) {
  if (!existsSync(join(root, f))) fail(`missing required file: ${f}`);
  else ok(`found ${f}`);
}

const nvm = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
if (nvm !== '22') fail(`.nvmrc must be "22", got "${nvm}"`);
else ok(`.nvmrc = 22`);

/** @param {string} dir */
function walkMd(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkMd(p);
    } else if (name.endsWith('.md')) {
      const content = readFileSync(p, 'utf8').trim();
      if (!content) fail(`empty markdown: ${relative(root, p)}`);
      else ok(`markdown ok: ${relative(root, p)}`);
    }
  }
}

walkMd(join(root, 'docs'));

if (failed) {
  console.error('\ncheck-docs failed');
  process.exit(1);
}
console.log('\ncheck-docs passed');
