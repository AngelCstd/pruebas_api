import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  dotenv.config();
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];
  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  const config = new DocumentBuilder()
    .setTitle('Hotel Provider Service API')
    .setDescription('Production-ready NestJS hotel provider service integrating with Nemo Group (Price Navigator) and offline Mock provider.')
    .setVersion('1.0.0')
    .addTag('Hotels')
    .addTag('Care')
    .addTag('Catalogs')
    .addTag('Locations')
    .addTag('System')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port);
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.stack : String(error), undefined, 'Bootstrap');
  process.exitCode = 1;
});
