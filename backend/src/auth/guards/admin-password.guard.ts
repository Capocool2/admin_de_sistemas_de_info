// backend/src/auth/guards/admin-password.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminPasswordGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Las consultas de solo lectura no requieren reconfirmar contraseña
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return true;
    }

    const user = req.user;
    if (!user?.id || user.rol !== 'admin') {
      throw new ForbiddenException(
        'Acceso denegado: Se requiere una sesión de administrador válida.',
      );
    }

    const bodyPassword =
      typeof req.body?.adminPassword === 'string' ? req.body.adminPassword : '';
    const headerPassword =
      typeof req.headers?.['x-admin-password'] === 'string'
        ? req.headers['x-admin-password']
        : '';
    const rawPassword = bodyPassword || headerPassword;

    if (!rawPassword) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ADMIN_PASSWORD_REQUIRED',
        message:
          'Debes ingresar tu contraseña de administrador para confirmar esta operación.',
      });
    }

    const rows: Array<{
      id: string;
      rol: string;
      estado: string;
      password_hash: string;
    }> = await this.dataSource.query(
      `SELECT id, rol, estado, password_hash FROM usuarios WHERE id = $1 LIMIT 1;`,
      [user.id],
    );

    const dbUser = rows[0];
    if (!dbUser || dbUser.rol !== 'admin' || dbUser.estado !== 'activo') {
      throw new ForbiddenException(
        'La cuenta de administrador no se encuentra activa para realizar cambios.',
      );
    }

    const isValid = await bcrypt.compare(rawPassword, dbUser.password_hash);
    if (!isValid) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'INVALID_ADMIN_PASSWORD',
        message:
          'Contraseña de administrador incorrecta. Operación rechazada por seguridad.',
      });
    }

    return true;
  }
}
