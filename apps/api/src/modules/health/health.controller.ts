import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ok, fail } from '../../common/envelope';
import { PrismaService } from '../prisma/prisma.service';

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
    // Redis wiring lands with identity module; M0 reports false until configured
    const redis = false;
    const ready = postgres;
    if (!ready) {
      res.status(503);
      return fail('SERVICE_UNAVAILABLE', 'dependencies not ready', {
        postgres,
        redis,
      });
    }
    return ok({ status: 'ready', postgres, redis });
  }
}
