// backend/src/trips/trips.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { TripsService } from './trips.service';
import { StartTripDto } from './dto/start-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/trips')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly jwtService: JwtService,
  ) {}

  private extractUserIdFromToken(req: Request): string | undefined {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const payload: any = this.jwtService.decode(token);
        return payload?.sub;
      } catch (err) {
        return undefined;
      }
    }
    return undefined;
  }

  /**
   * Endpoint: Iniciar viaje
   * POST /api/trips/start
   */
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async startTrip(@Body() dto: StartTripDto, @Req() req: Request) {
    const authUserId = this.extractUserIdFromToken(req);
    return this.tripsService.startTrip(dto, authUserId);
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
  async getActiveTrip(@Param('usuarioId') usuarioId: string, @Req() req: Request) {
    const authUserId = this.extractUserIdFromToken(req);
    const resolvedId = (usuarioId === 'me' && authUserId) ? authUserId : usuarioId;
    const trip = await this.tripsService.getActiveTripByUserId(resolvedId);
    return {
      statusCode: HttpStatus.OK,
      hasActiveTrip: !!trip,
      data: trip || null,
    };
  }

  /**
   * Endpoint: Forzar cancelación de un viaje activo (Solo Admin)
   * POST /api/trips/force-cancel/:viajeId
   */
  @Post('force-cancel/:viajeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async forceCancel(@Param('viajeId') viajeId: string) {
    return this.tripsService.forceCancelTrip(viajeId);
  }

  /**
   * Endpoint: Reseteo rápido del estado de viajes y flota (Solo Admin)
   * POST /api/trips/reset-dev
   */
  @Post('reset-dev')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async resetDev() {
    return this.tripsService.resetDevState();
  }

  /**
   * Endpoint: Obtener configuración pública de zonas geocercas (velocidad/tarifa)
   * GET /api/trips/zones
   */
  @Get('zones')
  async getPublicZones() {
    const zones = await this.tripsService.getPublicZones();
    return {
      statusCode: HttpStatus.OK,
      total: zones.length,
      data: zones,
    };
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
   * Endpoint: Historial de viajes (Solo Admin)
   * GET /api/trips
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getAllTrips() {
    const trips = await this.tripsService.getAllTrips();
    return {
      statusCode: HttpStatus.OK,
      total: trips.length,
      data: trips,
    };
  }
}

