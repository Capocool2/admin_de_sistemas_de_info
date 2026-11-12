import { IsNotEmpty, IsString, IsUrl, IsUUID } from 'class-validator';

export class EndTripDto {
  @IsUUID('4', { message: 'El viajeId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'El viajeId es obligatorio' })
  viajeId: string;

  @IsString({ message: 'La URL de la foto de evidencia debe ser una cadena válida' })
  @IsNotEmpty({ message: 'La foto de evidencia es obligatoria para validar el parqueo adecuado' })
  fotoEvidenciaUrl: string;
}

