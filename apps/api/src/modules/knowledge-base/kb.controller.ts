import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail, ok } from '../../common/envelope';
import { AuthService } from '../auth/auth.service';
import { readSid } from '../auth/cookies';
import { KbService } from './kb.service';

@Controller('kbs')
export class KbController {
  constructor(
    private readonly auth: AuthService,
    private readonly kbs: KbService,
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

  @Get()
  async list(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const data = await this.kbs.list(
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
    return ok(data);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { name?: string; description?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.kbs.create(userId, body?.name ?? '', body?.description);
    if (!result.ok) {
      res.status(result.http);
      return fail(result.code, result.message);
    }
    res.status(201);
    return ok(result.kb);
  }

  @Get(':kbId')
  async get(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.kbs.get(userId, kbId);
    if (!result.ok) {
      res.status(result.http);
      return fail(result.code, result.message);
    }
    return ok(result.kb);
  }

  @Patch(':kbId')
  async update(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Body() body: { name?: string; description?: string | null },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.kbs.update(userId, kbId, body ?? {});
    if (!result.ok) {
      res.status(result.http);
      return fail(result.code, result.message);
    }
    return ok(result.kb);
  }

  @Delete(':kbId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.kbs.delete(userId, kbId);
    if (!result.ok) {
      res.status(result.http);
      return fail(result.code, result.message);
    }
    return ok(null);
  }
}
