import type { ApiEnvelope } from './types';
import { ApiError } from './types';

/**
 * 与 Vite `base` 对齐，避免 code-server `/proxy/5173` 下请求打到 IDE 根路径。
 * - base=/ → `/api/v1`
 * - base=/proxy/5173/ → `/proxy/5173/api/v1`（由 Vite 代理到 Nest）
 */
function apiPrefix(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '/api/v1';
  return `${base.replace(/\/$/, '')}/api/v1`;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${apiPrefix()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('HTTP_ERROR', `无效响应 (${res.status})`, res.status);
  }

  if (!envelope.success || envelope.error) {
    throw new ApiError(
      envelope.error?.code ?? 'HTTP_ERROR',
      envelope.error?.message ?? `请求失败 (${res.status})`,
      res.status,
      (envelope.error?.details as Record<string, unknown> | null) ?? null,
    );
  }

  return envelope.data as T;
}
