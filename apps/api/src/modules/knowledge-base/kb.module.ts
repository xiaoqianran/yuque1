import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KbController } from './kb.controller';
import { KbService } from './kb.service';

@Module({
  imports: [AuthModule],
  controllers: [KbController],
  providers: [KbService],
  exports: [KbService],
})
export class KnowledgeBaseModule {}
