import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const isProd = process.env.NODE_ENV === 'production';

  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
  app.use(cookieParser());
  // Next.js가 /api/*를 리라이트하므로 브라우저는 same-site 요청만 보낸다. CORS는 로컬 개발(3000→4000 직접 호출)용
  app.enableCors({ origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000', credentials: true });
  app.enableShutdownHooks(); // Cloud Run SIGTERM 시 Prisma 연결 정리

  if (!isProd) {
    const doc = new DocumentBuilder().setTitle('CS Daily API').setVersion('0.1').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on :${port} (${isProd ? 'production' : 'development'})`, 'Bootstrap');
}
void bootstrap();
