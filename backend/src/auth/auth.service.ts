// backend/src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { MailService } from './mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Registro público exclusivo para TURISTAS.
   * Regla de negocio estricta: No inicia sesión ni devuelve token.
   * Requiere verificación obligatoria de correo por código OTP de 6 dígitos (15 min).
   */
  async register(dto: RegisterDto) {
    const { nombre_completo, documento_identidad, correo, telefono, password } = dto;
    const cleanEmail = correo.trim().toLowerCase();
    const cleanDoc = documento_identidad.trim();

    // 1. Validar unicidad de correo y documento en Neon
    const existing = await this.dataSource.query(
      `SELECT id, correo, documento_identidad FROM usuarios WHERE correo = $1 OR documento_identidad = $2 LIMIT 1;`,
      [cleanEmail, cleanDoc],
    );

    if (existing.length > 0) {
      if (existing[0].correo === cleanEmail) {
        throw new ConflictException('Ya existe una cuenta registrada con este correo electrónico.');
      }
      throw new ConflictException('Ya existe una cuenta con este documento de identidad.');
    }

    // 2. Hash seguro de contraseña con bcrypt (salt = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Generar código OTP numérico aleatorio de 6 dígitos con expiración de 15 minutos
    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    const codigoExpiraEn = new Date(Date.now() + 15 * 60 * 1000);

    // 4. Inserción con persistencia estricta en Neon Tech PostgreSQL
    // Forzar rol = 'turista', email_verificado = FALSE, estado = 'pendiente_verificacion'
    const insertResult = await this.dataSource.query(
      `INSERT INTO usuarios (
        nombre_completo, 
        documento_identidad, 
        correo, 
        telefono, 
        estado, 
        rol, 
        password_hash, 
        email_verificado,
        codigo_verificacion,
        codigo_expira_en,
        infracciones_perimetro,
        token_pago,
        created_at
      )
      VALUES ($1, $2, $3, $4, 'pendiente_verificacion', 'turista', $5, FALSE, $6, $7, 0, 'tok_wompi_test_turista', NOW())
      RETURNING id, nombre_completo, correo, telefono, rol, estado, email_verificado, created_at;`,
      [nombre_completo.trim(), cleanDoc, cleanEmail, telefono.trim(), passwordHash, codigoVerificacion, codigoExpiraEn],
    );

    const newUser = insertResult[0];
    this.logger.log(`Nuevo turista registrado (pendiente verificación): ${newUser.correo} (${newUser.id})`);

    // 5. Enviar código de verificación por correo (Nodemailer o fallback a consola)
    await this.mailService.sendVerificationCode(cleanEmail, codigoVerificacion, newUser.nombre_completo);

    // 6. IMPORTANTE: NO se devuelve token JWT ni se inicia sesión todavía.
    return {
      statusCode: 201,
      message: 'Usuario registrado exitosamente. Debes validar tu correo electrónico antes de iniciar sesión.',
      correo: newUser.correo,
    };
  }

  /**
   * Verificación obligatoria de correo electrónico mediante código de 6 dígitos.
   * Al validarse, NO inicia sesión automáticamente: responde confirmación para forzar login.
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const cleanEmail = dto.correo.trim().toLowerCase();
    const cleanCode = dto.codigo.trim();

    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, correo, estado, email_verificado, codigo_verificacion, codigo_expira_en
       FROM usuarios
       WHERE correo = $1
       LIMIT 1;`,
      [cleanEmail],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe ninguna cuenta registrada con este correo electrónico.');
    }

    const user = rows[0];

    if (user.email_verificado) {
      return {
        verified: true,
        message: 'Tu correo ya se encuentra verificado. Puedes iniciar sesión.',
      };
    }

    if (!user.codigo_verificacion || user.codigo_verificacion !== cleanCode) {
      throw new BadRequestException('Código de verificación incorrecto.');
    }

    const now = new Date();
    if (user.codigo_expira_en && new Date(user.codigo_expira_en) < now) {
      throw new BadRequestException('El código de verificación ha expirado. Solicita uno nuevo.');
    }

    // Actualizar usuario en Neon: email_verificado = TRUE, estado = 'activo', limpiar código
    await this.dataSource.query(
      `UPDATE usuarios
       SET email_verificado = TRUE,
           estado = CASE WHEN estado = 'dado_de_baja' THEN estado ELSE 'activo' END,
           codigo_verificacion = NULL,
           codigo_expira_en = NULL
       WHERE id = $1;`,
      [user.id],
    );

    this.logger.log(`Correo verificado exitosamente para: ${cleanEmail}`);

    return {
      verified: true,
      message: 'Correo verificado correctamente. Ahora puedes iniciar sesión.',
    };
  }

  /**
   * Reenvío de nuevo código numérico de 6 dígitos si expiró el anterior.
   */
  async resendVerificationCode(dto: ResendCodeDto) {
    const cleanEmail = dto.correo.trim().toLowerCase();

    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, correo, email_verificado, estado
       FROM usuarios
       WHERE correo = $1
       LIMIT 1;`,
      [cleanEmail],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe ninguna cuenta registrada con este correo.');
    }

    const user = rows[0];

    if (user.email_verificado) {
      return {
        statusCode: 200,
        message: 'Este correo electrónico ya está verificado.',
      };
    }

    const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
    const codigoExpiraEn = new Date(Date.now() + 15 * 60 * 1000);

    await this.dataSource.query(
      `UPDATE usuarios
       SET codigo_verificacion = $1,
           codigo_expira_en = $2
       WHERE id = $3;`,
      [nuevoCodigo, codigoExpiraEn, user.id],
    );

    await this.mailService.sendVerificationCode(cleanEmail, nuevoCodigo, user.nombre_completo);

    return {
      statusCode: 200,
      message: 'Nuevo código de verificación enviado a tu correo.',
    };
  }

  /**
   * Inicio de Sesión para Turistas y Administradores con validaciones estrictas
   */
  async login(dto: LoginDto) {
    const cleanEmail = dto.correo.trim().toLowerCase();

    // 1. Consultar usuario en Neon incluyendo password_hash, email_verificado, rol, estado, infracciones
    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, documento_identidad, correo, telefono, estado, rol, password_hash,
              email_verificado, infracciones_perimetro
       FROM usuarios 
       WHERE correo = $1 
       LIMIT 1;`,
      [cleanEmail],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas. Correo o contraseña incorrectos.');
    }

    const user = rows[0];

    // 2. Comparar hash de contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas. Correo o contraseña incorrectos.');
    }

    // 3. Validación estricta: Correo verificado obligatorio
    if (!user.email_verificado) {
      throw new ForbiddenException('Debes validar tu correo electrónico antes de iniciar sesión');
    }

    // 4. Validación estricta: Cuenta dada de baja por 3 salidas del perímetro
    if (user.estado === 'dado_de_baja') {
      throw new ForbiddenException('Tu cuenta ha sido dada de baja por exceder el límite de 3 salidas del área permitida del Malecón');
    }

    // 5. Suspensión administrativa
    if (user.estado === 'bloqueado') {
      throw new ForbiddenException('Tu cuenta se encuentra bloqueada por incidencias o saldo pendiente. Contacta a soporte.');
    }

    // 6. Generar JWT con roles y datos de usuario
    const payload = {
      sub: user.id,
      correo: user.correo,
      rol: user.rol,
      nombre_completo: user.nombre_completo,
    };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Inicio de sesión exitoso: ${user.correo} (Rol: ${user.rol}, Infracciones: ${user.infracciones_perimetro || 0})`);

    return {
      statusCode: 200,
      message: 'Inicio de sesión exitoso',
      access_token: accessToken,
      user: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        correo: user.correo,
        rol: user.rol,
        estado: user.estado,
        email_verificado: user.email_verificado,
        infracciones_perimetro: Number(user.infracciones_perimetro) || 0,
      },
    };
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  async getProfile(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, documento_identidad, correo, telefono, estado, rol,
              email_verificado, infracciones_perimetro, token_pago, created_at
       FROM usuarios 
       WHERE id = $1 
       LIMIT 1;`,
      [userId],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    return rows[0];
  }
}
