// backend/src/trips/trips.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { StartTripDto } from './dto/start-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';

@Controller('api/trips')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  /**
   * Endpoint: Iniciar viaje
   * POST /api/trips/start
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async startTrip(@Body() dto: StartTripDto) {
    return this.tripsService.startTrip(dto);
  }

  /**
   * Endpoint: Finalizar viaje con validación de parqueo y foto
   * POST /api/trips/end
   */
  @Post('end')
  @HttpCode(HttpStatus.OK)
  async endTrip(@Body() dto: EndTripDto) {
    return this.tripsService.endTrip(dto);
  }

  /**
   * Endpoint: Consultar viaje activo del usuario
   * GET /api/trips/active/:usuarioId
   */
  @Get('active/:usuarioId')
  async getActiveTrip(@Param('usuarioId') usuarioId: string) {
    const trip = await this.tripsService.getActiveTripByUserId(usuarioId);
    return {
      statusCode: HttpStatus.OK,
      hasActiveTrip: !!trip,
      data: trip || null,
    };
  }

  /**
   * Endpoint: Forzar cancelación de un viaje activo (para desarrollo)
   * POST /api/trips/force-cancel/:viajeId
   */
  @Post('force-cancel/:viajeId')
  @HttpCode(HttpStatus.OK)
  async forceCancel(@Param('viajeId') viajeId: string) {
    return this.tripsService.forceCancelTrip(viajeId);
  }

  /**
   * Endpoint: Reseteo rápido del estado de viajes y flota (para pruebas de desarrollo)
   * POST /api/trips/reset-dev
   */
  @Post('reset-dev')
  @HttpCode(HttpStatus.OK)
  async resetDev() {
    return this.tripsService.resetDevState();
  }

  /**
   * Endpoint: Obtener estado real de los monopatines en PostgreSQL
   * GET /api/trips/scooters
   */
  @Get('scooters')
  async getScooters() {
    const scooters = await this.tripsService.getAllScooters();
    return {
      statusCode: HttpStatus.OK,
      total: scooters.length,
      data: scooters,
    };
  }

  /**
   * Endpoint: Historial de viajes
   * GET /api/trips
   */
  @Get()
  async getAllTrips() {
    const trips = await this.tripsService.getAllTrips();
    return {
      statusCode: HttpStatus.OK,
      total: trips.length,
      data: trips,
    };
  }
}

