// backend/src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from './decorators/current-user.decorator';

@Controller('api/auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registro exclusivo para Turistas
   * POST /api/auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Login unificado para Turistas y Administradores
   * POST /api/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Obtener datos del perfil actual con token JWT
   * GET /api/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: UserPayload) {
    const profile = await this.authService.getProfile(user.id);
    return {
      statusCode: HttpStatus.OK,
      user: profile,
    };
  }
}

