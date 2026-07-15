import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail, ok } from '../../common/envelope';
import { AuthService } from '../auth/auth.service';
import { readSid } from '../auth/cookies';
import { MembersService } from './members.service';

@Controller('kbs/:kbId/members')
export class MembersController {
  constructor(
    private readonly auth: AuthService,
    private readonly members: MembersService,
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

  @Get()
  async list(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.members.list(userId, kbId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Post()
  async add(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Body() body: { mobileE164?: string; role?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.members.add(userId, kbId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    res.status(201);
    return ok(result.data);
  }

  @Patch(':userId')
  async update(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { role?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.members.updateRole(
      userId,
      kbId,
      targetUserId,
      body?.role,
    );
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Delete(':userId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Param('userId') targetUserId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.members.remove(userId, kbId, targetUserId);
    if (!result.ok) return this.failResult(res, result);
    return ok(null);
  }
}
