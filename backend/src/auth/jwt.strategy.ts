// backend/src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserPayload } from './decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SAME_SECRET_KEY_MALECON_BARRANQUILLA_2026',
    });
  }

  async validate(payload: { sub: string; correo: string; rol: 'admin' | 'turista'; nombre_completo: string }): Promise<UserPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
    return {
      id: payload.sub,
      correo: payload.correo,
      rol: payload.rol,
      nombre_completo: payload.nombre_completo,
    };
  }
}

