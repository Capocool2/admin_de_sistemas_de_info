// backend/src/auth/dto/resend-code.dto.ts
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendCodeDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo: string;
}
