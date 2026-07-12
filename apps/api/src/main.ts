import { NestFactory } from '@nestjs/core';
import { loadMonorepoEnv } from './load-env';
import { AppModule } from './app.module';

// Must run before AppModule / PrismaService read process.env
loadMonorepoEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
