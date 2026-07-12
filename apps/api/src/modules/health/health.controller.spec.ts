import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('health returns ok envelope', () => {
    const prisma = { ping: async () => true } as unknown as PrismaService;
    const ctl = new HealthController(prisma);
    const body = ctl.health();
    assert.equal(body.success, true);
    assert.equal(body.data?.status, 'ok');
    assert.equal(body.error, null);
  });
});
