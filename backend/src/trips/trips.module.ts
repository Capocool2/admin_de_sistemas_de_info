import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { Viaje } from '../database/entities/viaje.entity';
import { Monopatin } from '../database/entities/monopatin.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { Pago } from '../database/entities/pago.entity';
import { Alerta } from '../database/entities/alerta.entity';
import { ZonaGeocerca } from '../database/entities/zona-geocerca.entity';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Viaje,
      Monopatin,
      Usuario,
      Pago,
      Alerta,
      ZonaGeocerca,
    ]),
    TelemetryModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}

