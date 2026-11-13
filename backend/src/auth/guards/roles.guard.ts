// backend/src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'admin' | 'turista'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.rol) {
      throw new ForbiddenException('Acceso denegado: Usuario no autenticado');
    }

    const hasRole = requiredRoles.includes(user.rol);
    if (!hasRole) {
      throw new ForbiddenException(`Acceso restringido. Se requiere rol: ${requiredRoles.join(' o ')}`);
    }

    return true;
  }
}

