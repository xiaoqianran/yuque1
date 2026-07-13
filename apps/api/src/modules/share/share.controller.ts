import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail, ok } from '../../common/envelope';
import { AuthService } from '../auth/auth.service';
import { readSid } from '../auth/cookies';
import { ShareService } from './share.service';

@Controller()
export class ShareController {
  constructor(
    private readonly auth: AuthService,
    private readonly shares: ShareService,
  ) {}

  private async requireUser(
    req: Request,
    res: Response,
  ): Promise<string | null> {
    const userId = await this.auth.resolveSessionUserId(readSid(req));
    if (!userId) {
      res.status(401);
      return null;
    }
    return userId;
  }

  private failResult(
    res: Response,
    result: {
      ok: false;
      code: string;
      message: string;
      http: number;
      details?: Record<string, unknown> | null;
    },
  ) {
    res.status(result.http);
    return fail(result.code, result.message, result.details ?? null);
  }

  @Get('nodes/:nodeId/share')
  async getStatus(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.shares.getStatus(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Put('nodes/:nodeId/share')
  async enable(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body() body?: { expiresAt?: string | null },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.shares.enable(userId, nodeId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Delete('nodes/:nodeId/share')
  async disable(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.shares.disable(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(null);
  }

  /** 公开接口：无需登录 */
  @Get('share/:token')
  async getByToken(
    @Res({ passthrough: true }) res: Response,
    @Param('token') token: string,
  ) {
    const result = await this.shares.getByToken(token);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }
}
