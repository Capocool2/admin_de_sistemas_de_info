// backend/src/auth/dto/login.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo: string;

  @IsString({ message: 'La contraseña es obligatoria' })
  @IsNotEmpty({ message: 'Debe ingresar la contraseña' })
  password: string;
}

