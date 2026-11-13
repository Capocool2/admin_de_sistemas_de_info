// backend/src/admin/admin.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import {
  RelocateScooterDto,
  SendScooterNoticeDto,
  UpdateScooterStatusDto,
  UpdateUserStatusDto,
  UpdateZoneConfigDto,
} from './dto/admin.dto';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('fleet')
  async getFleet() {
    const fleet = await this.adminService.getAdminFleet();
    return {
      statusCode: HttpStatus.OK,
      total: fleet.length,
      data: fleet,
    };
  }

  @Get('summary')
  async getSummary() {
    const summary = await this.adminService.getSummary();
    return {
      statusCode: HttpStatus.OK,
      data: summary,
    };
  }

  @Patch('scooters/:id/status')
  async updateScooterStatus(
    @Param('id') scooterId: string,
    @Body() dto: UpdateScooterStatusDto,
  ) {
    return this.adminService.updateScooterStatus(scooterId, dto);
  }

  @Post('scooters/:id/relocate')
  @HttpCode(HttpStatus.OK)
  async relocateScooter(
    @Param('id') scooterId: string,
    @Body() dto: RelocateScooterDto,
  ) {
    return this.adminService.relocateScooter(scooterId, dto);
  }

  @Post('scooters/:id/clear-lock')
  @HttpCode(HttpStatus.OK)
  async clearScooterLock(@Param('id') scooterId: string) {
    return this.adminService.clearScooterLock(scooterId);
  }

  @Post('scooters/:id/notice')
  @HttpCode(HttpStatus.OK)
  async sendNotice(
    @Param('id') scooterId: string,
    @Body() dto: SendScooterNoticeDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.adminService.sendScooterNotice(scooterId, dto, user?.nombre_completo);
  }

  @Get('alerts')
  async getAlerts(@Query('estado') estado?: string) {
    const data = await this.adminService.getAlerts(estado);
    return {
      statusCode: HttpStatus.OK,
      data,
    };
  }

  @Patch('alerts/:id/attend')
  async attendAlert(@Param('id') alertId: string) {
    return this.adminService.attendAlert(alertId);
  }

  @Get('users')
  async getUsers() {
    const users = await this.adminService.getUsers();
    return {
      statusCode: HttpStatus.OK,
      total: users.length,
      data: users,
    };
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: UserPayload,
  ) {
    return this.adminService.updateUserStatus(userId, dto, admin?.id);
  }

  @Get('zones')
  async getZones() {
    const zones = await this.adminService.getZones();
    return {
      statusCode: HttpStatus.OK,
      total: zones.length,
      data: zones,
    };
  }

  @Patch('zones/:id')
  async updateZone(
    @Param('id') zoneId: string,
    @Body() dto: UpdateZoneConfigDto,
  ) {
    return this.adminService.updateZone(zoneId, dto);
  }
}

