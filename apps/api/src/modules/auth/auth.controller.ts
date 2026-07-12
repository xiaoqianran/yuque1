import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { fail, ok } from '../../common/envelope';
import { AuthService } from './auth.service';
import { clearSidCookie, readSid, setSidCookie } from './cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sms/send')
  async sendSms(
    @Body() body: { mobileE164?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const mobile = body?.mobileE164 ?? '';
    const result = await this.auth.sendSms(mobile);
    if (!result.ok) {
      res.status(result.code === 'SMS_RATE_LIMITED' ? 429 : 400);
      return fail(result.code, result.message);
    }
    return ok(null);
  }

  @Post('sms/login')
  async login(
    @Body() body: { mobileE164?: string; code?: string; nickname?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithSms(
      body?.mobileE164 ?? '',
      body?.code ?? '',
      body?.nickname,
    );
    if (!result.ok) {
      res.status(result.http);
      return fail(result.code, result.message);
    }
    setSidCookie(res, result.sid);
    return ok(result.user);
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sid = readSid(req);
    const userId = await this.auth.resolveSessionUserId(sid);
    if (!userId) {
      res.status(401);
      return fail('UNAUTHORIZED', '未登录');
    }
    await this.auth.logout(sid);
    clearSidCookie(res);
    return ok(null);
  }

  @Get('me')
  async me(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = readSid(req);
    const userId = await this.auth.resolveSessionUserId(sid);
    if (!userId) {
      res.status(401);
      return fail('UNAUTHORIZED', '未登录');
    }
    const user = await this.auth.me(userId);
    if (!user) {
      res.status(401);
      return fail('UNAUTHORIZED', '未登录');
    }
    return ok(user);
  }
}
