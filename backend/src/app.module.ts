// backend/src/app.module.ts
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './database/entities/usuario.entity';
import { Monopatin } from './database/entities/monopatin.entity';
import { ZonaGeocerca } from './database/entities/zona-geocerca.entity';
import { Viaje } from './database/entities/viaje.entity';
import { Pago } from './database/entities/pago.entity';
import { Alerta } from './database/entities/alerta.entity';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TripsModule } from './trips/trips.module';
import { AuthModule } from './auth/auth.module';

const rawDbUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawDbUrl.replace('&channel_binding=require', '').replace('?channel_binding=require', '');

@Module({
  imports: [
    // 1. Carga de variables de entorno globales (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Conexión estricta a Neon PostgreSQL con PostGIS
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: cleanDbUrl,
      ssl: { rejectUnauthorized: false },
      entities: [Usuario, Monopatin, ZonaGeocerca, Viaje, Pago, Alerta],
      synchronize: false, // La BD se gestiona mediante scripts DDL en Neon
      logging: process.env.NODE_ENV === 'development',
    }),

    // 3. Módulos de la Aplicación
    AuthModule,
    TelemetryModule,
    TripsModule,
  ],
})
export class AppModule {}
