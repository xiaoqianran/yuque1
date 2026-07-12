import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

function mockRes() {
  const state = { statusCode: 200 };
  return {
    state,
    res: {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
    } as unknown as import('express').Response,
  };
}

describe('HealthController', () => {
  it('health returns ok envelope', () => {
    const prisma = { ping: async () => true } as unknown as PrismaService;
    const ctl = new HealthController(prisma);
    const body = ctl.health();
    assert.equal(body.success, true);
    assert.equal(body.data?.status, 'ok');
    assert.equal(body.error, null);
  });

  it('ready returns 503 when postgres ping fails', async () => {
    const prisma = { ping: async () => false } as unknown as PrismaService;
    const ctl = new HealthController(prisma);
    const { res, state } = mockRes();
    delete process.env.REDIS_URL;
    const body = await ctl.ready(res);
    assert.equal(state.statusCode, 503);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'SERVICE_UNAVAILABLE');
    assert.equal(body.error?.details?.postgres, false);
  });

  it('ready returns 200 when postgres ping succeeds', async () => {
    const prisma = { ping: async () => true } as unknown as PrismaService;
    const ctl = new HealthController(prisma);
    const { res, state } = mockRes();
    delete process.env.REDIS_URL;
    const body = await ctl.ready(res);
    assert.equal(state.statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(body.data?.postgres, true);
  });
});
