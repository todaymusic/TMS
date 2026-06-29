import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 모든 라우트에 /api prefix
  app.setGlobalPrefix('api');

  // DTO 검증 + 화이트리스트 (정의 안 된 필드 제거, 타입 자동 변환)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 프론트(Next.js localhost:3000) CORS 허용
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`🚀 TMS API running on http://localhost:${port}/api`);
}
void bootstrap();
