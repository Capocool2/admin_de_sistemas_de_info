// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('SAME_Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para clientes móviles y paneles administrativos
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Habilitar pipes globales de validación para los DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`=============================================================`);
  logger.log(`🚀 Sistema SAME Backend iniciado exitosamente en puerto: ${port}`);
  logger.log(`🌐 Servidor HTTP API: http://localhost:${port}`);
  logger.log(`🛰️ Servidor WebSocket (Socket.io): ws://localhost:${port}`);
  logger.log(`📍 Contexto Operativo: Gran Malecón del Río (Barranquilla)`);
  logger.log(`=============================================================`);
}

bootstrap();

