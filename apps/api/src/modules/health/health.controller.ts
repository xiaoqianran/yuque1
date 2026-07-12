import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ok, fail } from '../../common/envelope';
import { PrismaService } from '../prisma/prisma.service';
import { pingRedisUrl } from './redis-ping';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return ok({ status: 'ok' });
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const postgres = await this.prisma.ping();

    const redisUrl = process.env.REDIS_URL;
    let redis = false;
    if (redisUrl) {
      redis = await pingRedisUrl(redisUrl);
    }
    // M0: Redis optional for process liveness of non-session routes.
    // When REDIS_URL is set, report its reachability but ready only requires postgres.
    const ready = postgres;

    if (!ready) {
      res.status(503);
      return fail('SERVICE_UNAVAILABLE', 'dependencies not ready', {
        postgres,
        redis,
        redisConfigured: Boolean(redisUrl),
      });
    }
    return ok({
      status: 'ready',
      postgres,
      redis,
      redisConfigured: Boolean(redisUrl),
    });
  }
}
