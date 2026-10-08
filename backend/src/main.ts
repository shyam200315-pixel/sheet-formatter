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

  // Prevent Render Cold Starts by self-pinging every 14 minutes
  // Render automatically provides the RENDER_EXTERNAL_URL environment variable
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderExternalUrl) {
    setInterval(() => {
      console.log(`Pinging self (${renderExternalUrl}) to prevent cold start...`);
      fetch(renderExternalUrl).catch((err) => console.error('Self-ping failed:', err));
    }, 14 * 60 * 1000); // 14 minutes
  }
}
bootstrap();
