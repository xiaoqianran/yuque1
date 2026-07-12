import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SmsService } from './sms.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SmsService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
