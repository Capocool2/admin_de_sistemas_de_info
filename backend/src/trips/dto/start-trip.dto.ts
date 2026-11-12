// backend/src/trips/dto/start-trip.dto.ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartTripDto {
  @IsUUID('4', { message: 'El usuarioId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El usuarioId es obligatorio' })
  usuarioId: string;

  @IsString({ message: 'El scooterId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El scooterId es obligatorio (ej: SCOOTER-01)' })
  scooterId: string;

  @IsOptional()
  @IsBoolean({ message: 'forzarCierreAnterior debe ser booleano' })
  forzarCierreAnterior?: boolean;
}
