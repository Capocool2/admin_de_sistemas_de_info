// backend/src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Registro público exclusivo para TURISTAS.
   * La regla de negocio estricta prohíbe crear administradores desde este endpoint.
   */
  async register(dto: RegisterDto) {
    const { nombre_completo, documento_identidad, correo, telefono, password } = dto;
    const cleanEmail = correo.trim().toLowerCase();
    const cleanDoc = documento_identidad.trim();

    // 1. Validar unicidad de correo y documento
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

    // 2. Hash de contraseña seguro
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 3. Forzar siempre rol = 'turista'
    const insertResult = await this.dataSource.query(
      `INSERT INTO usuarios (
        nombre_completo, 
        documento_identidad, 
        correo, 
        telefono, 
        estado, 
        rol, 
        password_hash, 
        token_pago,
        created_at
      )
      VALUES ($1, $2, $3, $4, 'activo', 'turista', $5, 'tok_wompi_test_turista', NOW())
      RETURNING id, nombre_completo, correo, telefono, rol, estado, created_at;`,
      [nombre_completo.trim(), cleanDoc, cleanEmail, telefono.trim(), passwordHash],
    );

    const newUser = insertResult[0];
    this.logger.log(`Nuevo turista registrado exitosamente: ${newUser.correo} (${newUser.id})`);

    // 4. Generar JWT
    const payload = {
      sub: newUser.id,
      correo: newUser.correo,
      rol: newUser.rol,
      nombre_completo: newUser.nombre_completo,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      statusCode: 201,
      message: 'Usuario registrado exitosamente como Turista',
      access_token: accessToken,
      user: {
        id: newUser.id,
        nombre_completo: newUser.nombre_completo,
        correo: newUser.correo,
        rol: newUser.rol,
      },
    };
  }

  /**
   * Inicio de Sesión para Turistas y Administradores
   */
  async login(dto: LoginDto) {
    const cleanEmail = dto.correo.trim().toLowerCase();

    // 1. Consultar usuario en Neon incluyendo password_hash
    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, documento_identidad, correo, telefono, estado, rol, password_hash
       FROM usuarios 
       WHERE correo = $1 
       LIMIT 1;`,
      [cleanEmail],
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Credenciales inválidas. Correo o contraseña incorrectos.');
    }

    const user = rows[0];

    // 2. Validar estado de la cuenta
    if (user.estado !== 'activo') {
      throw new UnauthorizedException('Tu cuenta se encuentra bloqueada o suspendida. Contacta a soporte.');
    }

    // 3. Comparar hash de contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas. Correo o contraseña incorrectos.');
    }

    // 4. Generar JWT con roles
    const payload = {
      sub: user.id,
      correo: user.correo,
      rol: user.rol,
      nombre_completo: user.nombre_completo,
    };
    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`Inicio de sesión exitoso: ${user.correo} (Rol: ${user.rol})`);

    return {
      statusCode: 200,
      message: 'Inicio de sesión exitoso',
      access_token: accessToken,
      user: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        correo: user.correo,
        rol: user.rol,
      },
    };
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  async getProfile(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, nombre_completo, documento_identidad, correo, telefono, estado, rol, token_pago, created_at
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
