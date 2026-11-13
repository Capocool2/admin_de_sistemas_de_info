// backend/src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'El nombre completo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre_completo: string;

  @IsString({ message: 'El documento de identidad debe ser válido' })
  @IsNotEmpty({ message: 'El documento de identidad es obligatorio' })
  @MinLength(5, { message: 'El documento de identidad debe tener al menos 5 caracteres' })
  documento_identidad: string;

  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo: string;

  @IsString({ message: 'El teléfono debe ser válido' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @MinLength(7, { message: 'El teléfono debe tener al menos 7 dígitos' })
  telefono: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener mínimo 6 caracteres' })
  password: string;
}
