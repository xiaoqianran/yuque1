import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * VITE_ALLOWED_HOSTS（仓库根 .env 或进程环境）:
 * - 未设置 / `all` / `true` / `*` → 允许任意 Host
 * - 逗号分隔域名 → 仅允许列表
 */
function resolveAllowedHosts(raw: string | undefined): true | string[] {
  const v = (raw ?? 'all').trim().toLowerCase();
  if (v === '' || v === 'all' || v === 'true' || v === '*') {
    return true;
  }
  return raw!
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeBase(base: string): string {
  if (!base || base === '/') return '/';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

/**
 * code-server Ports 默认打开 /proxy/5173/（会剥前缀再转给 Vite）。
 *
 * 错误做法：base=/absproxy/5173/ → 浏览器在 /proxy/5173/ 下被重定向到
 *   /proxy/5173/ + absproxy/5173/ = /proxy/5173/absproxy/5173/（双重路径）
 *
 * 正确做法：
 * 1. base 与 VSCODE_PROXY_URI 一致 → /proxy/5173/（资源 URL 带此前缀，避免白屏）
 * 2. 中间件把剥掉后的 /src/... 再补回 /proxy/5173/src/... 供 Vite 匹配 base
 *
 * 解析顺序：VITE_BASE → VSCODE_PROXY_URI → /
 */
function resolveBase(
  port: number,
  env: Record<string, string>,
): { base: string; publicOrigin: string | undefined } {
  const explicit = process.env.VITE_BASE ?? env.VITE_BASE;
  if (explicit?.trim()) {
    return {
      base: normalizeBase(explicit.trim()),
      publicOrigin: process.env.VITE_DEV_ORIGIN ?? env.VITE_DEV_ORIGIN,
    };
  }

  const proxyUri = process.env.VSCODE_PROXY_URI ?? env.VSCODE_PROXY_URI;
  if (proxyUri?.includes('{{port}}')) {
    // 保持 /proxy（与 Ports 面板一致），不要改成 /absproxy
    const filled = proxyUri.replaceAll('{{port}}', String(port));
    try {
      const u = new URL(filled);
      return {
        base: normalizeBase(u.pathname),
        publicOrigin: `${u.protocol}//${u.host}`,
      };
    } catch {
      /* fall through */
    }
  }

  return { base: '/', publicOrigin: process.env.VITE_DEV_ORIGIN ?? env.VITE_DEV_ORIGIN };
}

/**
 * code-server /proxy 会剥掉 /proxy/5173 前缀；Vite base 又需要完整路径。
 * 在进入 Vite 内部中间件前把前缀补回。
 */
function restoreStrippedProxyBase(base: string): Plugin {
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  return {
    name: 'restore-stripped-proxy-base',
    configureServer(server) {
      if (!prefix) return;
      server.middlewares.use((req, _res, next) => {
        const url = req.url;
        if (!url) return next();
        // 已带 base / 或 query-only
        if (
          url === prefix ||
          url.startsWith(`${prefix}/`) ||
          url.startsWith(`${prefix}?`)
        ) {
          return next();
        }
        // Vite / 依赖探活等
        if (url.startsWith('/@') || url.startsWith('/src') || url.startsWith('/node_modules') || url === '/' || url.startsWith('/?') || url.startsWith('/api') || url.startsWith('/favicon')) {
          req.url = prefix + (url.startsWith('/') ? url : `/${url}`);
          return next();
        }
        // 其余路径同样补前缀，避免 SPA fallback 丢 base
        req.url = prefix + (url.startsWith('/') ? url : `/${url}`);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, monorepoRoot, '');
  const allowedHosts = resolveAllowedHosts(
    process.env.VITE_ALLOWED_HOSTS ?? fileEnv.VITE_ALLOWED_HOSTS,
  );

  const port = Number(process.env.VITE_DEV_PORT ?? fileEnv.VITE_DEV_PORT ?? 5173);
  const { base, publicOrigin } = resolveBase(port, fileEnv);
  const baseNoSlash = base === '/' ? '' : base.replace(/\/$/, '');

  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ??
    fileEnv.VITE_API_PROXY_TARGET ??
    'http://127.0.0.1:3000';

  const proxy: Record<
    string,
    { target: string; changeOrigin: boolean; rewrite?: (p: string) => string }
  > = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
    },
  };
  if (baseNoSlash) {
    proxy[`${baseNoSlash}/api`] = {
      target: apiProxyTarget,
      changeOrigin: true,
      rewrite: (p) => p.slice(baseNoSlash.length) || '/',
    };
  }

  const behindPathProxy = base !== '/';
  const hmrHost = process.env.VITE_HMR_HOST ?? fileEnv.VITE_HMR_HOST;
  const hmrProtocol = (process.env.VITE_HMR_PROTOCOL ??
    fileEnv.VITE_HMR_PROTOCOL ??
    (behindPathProxy ? 'wss' : 'ws')) as 'ws' | 'wss';
  const hmrClientPort = Number(
    process.env.VITE_HMR_CLIENT_PORT ??
      fileEnv.VITE_HMR_CLIENT_PORT ??
      (behindPathProxy ? 443 : port),
  );

  return {
    plugins: [restoreStrippedProxyBase(base), react()],
    envDir: monorepoRoot,
    base,
    server: {
      host: true,
      port,
      strictPort: true,
      allowedHosts,
      origin: publicOrigin
        ? `${publicOrigin.replace(/\/$/, '')}${baseNoSlash}`
        : undefined,
      hmr: behindPathProxy
        ? {
            protocol: hmrProtocol,
            clientPort: hmrClientPort,
            ...(hmrHost ? { host: hmrHost } : {}),
          }
        : hmrHost
          ? { host: hmrHost, protocol: hmrProtocol, clientPort: hmrClientPort }
          : true,
      proxy,
    },
  };
});
