import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { HealthModule } from './modules/health/health.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/kb.module';
import { KvModule } from './modules/kv/kv.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { TreeModule } from './modules/tree/tree.module';

@Module({
  imports: [
    PrismaModule,
    KvModule,
    HealthModule,
    AuthModule,
    KnowledgeBaseModule,
    TreeModule,
    ContentModule,
  ],
})
export class AppModule {}
