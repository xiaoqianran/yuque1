import { Body, Controller, Get, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail, ok } from '../../common/envelope';
import { AuthService } from '../auth/auth.service';
import { readSid } from '../auth/cookies';
import { ContentService } from './content.service';

@Controller('nodes')
export class ContentController {
  constructor(
    private readonly auth: AuthService,
    private readonly content: ContentService,
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

  @Get(':nodeId/content')
  async get(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.content.get(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Put(':nodeId/content')
  async put(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body() body: { expectedVersion?: number; bodyMd?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.content.put(userId, nodeId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Post(':nodeId/content/overwrite')
  async overwrite(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body() body: { baseVersion?: number; bodyMd?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.content.overwrite(userId, nodeId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Post(':nodeId/content/save-as')
  async saveAs(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body()
    body: { bodyMd?: string; title?: string; parentId?: string | null },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.content.saveAs(userId, nodeId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    res.status(201);
    return ok(result.data);
  }
}
