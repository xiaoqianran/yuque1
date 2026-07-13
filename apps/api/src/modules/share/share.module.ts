import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
  imports: [AuthModule],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
