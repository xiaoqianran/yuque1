/**
 * Load monorepo root .env then apps/api/.env, then run prisma CLI.
 * Fixes: `pnpm --filter @yuque1/api exec prisma ...` not seeing root DATABASE_URL.
 */
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const apiRoot = resolve(__dirname, '..');
const monorepoRoot = resolve(apiRoot, '../..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
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
    // Do not override already-exported env (CI / shell wins)
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(resolve(monorepoRoot, '.env'));
loadEnvFile(resolve(apiRoot, '.env'));

if (!process.env.DATABASE_URL) {
  console.error(`
[prisma] DATABASE_URL 未设置。

请任选其一：
  1) 在仓库根目录配置 .env（推荐）：
       cp .env.example .env
       # 本地 Compose 示例：
       # DATABASE_URL=postgresql://yuque:localdevonly@localhost:5432/yuque1?schema=public
  2) 或在 apps/api/.env 中写入 DATABASE_URL
  3) 或 export DATABASE_URL=...

然后重新执行：
  pnpm --filter @yuque1/api prisma:deploy
`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-prisma.cjs <prisma-args...>');
  process.exit(1);
}

const result = spawnSync('prisma', args, {
  stdio: 'inherit',
  cwd: apiRoot,
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);
