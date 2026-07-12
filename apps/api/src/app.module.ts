import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/kb.module';
import { KvModule } from './modules/kv/kv.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    KvModule,
    HealthModule,
    AuthModule,
    KnowledgeBaseModule,
  ],
})
export class AppModule {}
