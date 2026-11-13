// backend/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Monopatin } from '../database/entities/monopatin.entity';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { ZonaGeocerca } from '../database/entities/zona-geocerca.entity';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Monopatin, Alerta, Usuario, ZonaGeocerca]),
    TelemetryModule,
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

