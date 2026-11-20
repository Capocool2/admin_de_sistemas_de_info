// backend/src/auth/dto/verify-email.dto.ts
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo: string;

  @IsString({ message: 'El código debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El código de verificación es obligatorio' })
  @Length(6, 6, { message: 'El código de verificación debe tener exactamente 6 dígitos' })
  codigo: string;
}
