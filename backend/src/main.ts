import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend Vite app (running on different port or same domain)
  app.enableCors();
  
  // Increase payload limit because we sync large Historical Sales datasets in bulk
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
