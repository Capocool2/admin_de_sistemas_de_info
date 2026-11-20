// backend/src/admin/dto/admin.dto.ts
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminPasswordDto {
  @IsOptional()
  @IsString()
  adminPassword?: string;
}

export class UpdateScooterStatusDto extends AdminPasswordDto {
  @IsIn(['disponible', 'mantenimiento'], {
    message: 'El estado permitido para operador es disponible o mantenimiento.',
  })
  estado: 'disponible' | 'mantenimiento';

  @IsOptional()
  @IsBoolean()
  deferIfInUse?: boolean;
}

export class RelocateScooterDto extends AdminPasswordDto {
  @IsIn(['P1', 'P2', 'P3'], {
    message: 'Estación inválida. Usa P1, P2 o P3.',
  })
  stationId: 'P1' | 'P2' | 'P3';

  @IsOptional()
  @IsBoolean()
  rechargeBattery?: boolean;
}

export class SendScooterNoticeDto extends AdminPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'El mensaje operativo no puede estar vacío.' })
  @MinLength(3, { message: 'El mensaje debe tener al menos 3 caracteres.' })
  @MaxLength(240, { message: 'El mensaje no puede superar 240 caracteres.' })
  message: string;
}

export class UpdateUserStatusDto extends AdminPasswordDto {
  @IsIn(['activo', 'bloqueado'], {
    message: 'El estado de usuario debe ser activo o bloqueado.',
  })
  estado: 'activo' | 'bloqueado';
}

export class UpdateZoneConfigDto extends AdminPasswordDto {
  @IsOptional()
  @IsNumber()
  @Min(5, { message: 'El límite mínimo de velocidad es 5 km/h.' })
  @Max(25, { message: 'Por seguridad en el Malecón, el límite máximo permitido es 25 km/h.' })
  limite_velocidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(100, { message: 'La tarifa mínima por minuto es $100 COP.' })
  @Max(10000, { message: 'La tarifa máxima por minuto es $10.000 COP.' })
  tarifa_minuto?: number;

  @IsOptional()
  @IsBoolean()
  applyRateToAllZones?: boolean;
}

export class DispatchRecoveryDto extends AdminPasswordDto {
  @IsOptional()
  @IsIn(['P1', 'P2', 'P3'], {
    message: 'Estación inválida. Usa P1, P2 o P3.',
  })
  stationId?: 'P1' | 'P2' | 'P3';

  @IsOptional()
  @IsBoolean()
  rechargeBattery?: boolean;
}

export class ScheduleFreeEndDto extends AdminPasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(240, { message: 'El motivo no puede superar 240 caracteres.' })
  reason?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'El aviso mínimo es 1 minuto.' })
  @Max(15, { message: 'El aviso máximo permitido es 15 minutos.' })
  delayMinutes?: number;
}

