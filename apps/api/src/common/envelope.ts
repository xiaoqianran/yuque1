import { randomUUID } from 'node:crypto';

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  requestId: string;
};

export function ok<T>(data: T, requestId = randomUUID()): ApiEnvelope<T> {
  return { success: true, data, error: null, requestId };
}

export function fail(
  code: string,
  message: string,
  details: Record<string, unknown> | null = null,
  requestId = randomUUID(),
): ApiEnvelope<null> {
  return {
    success: false,
    data: null,
    error: { code, message, details },
    requestId,
  };
}
