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
import { TreeService } from './tree.service';

@Controller()
export class TreeController {
  constructor(
    private readonly auth: AuthService,
    private readonly tree: TreeService,
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

  @Get('kbs/:kbId/tree')
  async getTree(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.getTree(userId, kbId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Get('kbs/:kbId/trash')
  async listTrash(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.listTrash(userId, kbId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Post('kbs/:kbId/trash/empty')
  async emptyTrash(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.emptyTrash(userId, kbId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Get('kbs/:kbId/nodes')
  async search(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.search(
      userId,
      kbId,
      q ?? '',
      limit ? Number(limit) : 50,
    );
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Post('kbs/:kbId/nodes')
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('kbId') kbId: string,
    @Body()
    body: { type?: string; title?: string; parentId?: string | null },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.create(userId, kbId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    res.status(201);
    return ok(result.data);
  }

  @Get('nodes/:nodeId')
  async get(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.get(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Patch('nodes/:nodeId')
  async update(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body() body: { title?: string },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.update(userId, nodeId, body?.title);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Delete('nodes/:nodeId')
  async remove(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.delete(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(null);
  }

  @Post('nodes/:nodeId/restore')
  async restore(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.restore(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }

  @Delete('nodes/:nodeId/permanent')
  async purge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.purge(userId, nodeId);
    if (!result.ok) return this.failResult(res, result);
    return ok(null);
  }

  @Post('nodes/:nodeId/move')
  async move(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('nodeId') nodeId: string,
    @Body() body: { parentId?: string | null; sortOrder?: number },
  ) {
    const userId = await this.requireUser(req, res);
    if (!userId) return fail('UNAUTHORIZED', '未登录');
    const result = await this.tree.move(userId, nodeId, body ?? {});
    if (!result.ok) return this.failResult(res, result);
    return ok(result.data);
  }
}
