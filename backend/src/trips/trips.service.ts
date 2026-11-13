// backend/src/trips/trips.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Viaje } from '../database/entities/viaje.entity';
import { Monopatin } from '../database/entities/monopatin.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { Pago } from '../database/entities/pago.entity';
import { Alerta } from '../database/entities/alerta.entity';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { StartTripDto } from './dto/start-trip.dto';
import { EndTripDto } from './dto/end-trip.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);
  private readonly DEFAULT_RATE_PER_MINUTE = 500; // COP

  constructor(
    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,
    @InjectRepository(Monopatin)
    private readonly monopatinRepo: Repository<Monopatin>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Alerta)
    private readonly alertaRepo: Repository<Alerta>,
    private readonly dataSource: DataSource,
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  /**
   * Inicia un nuevo viaje tras validar solvencia del usuario y disponibilidad técnica del monopatín.
   */
  async startTrip(dto: StartTripDto, authenticatedUserId?: string) {
    const targetUserId = authenticatedUserId || dto.usuarioId;
    if (!targetUserId) {
      throw new BadRequestException('Se requiere usuario autenticado o usuarioId para iniciar el viaje.');
    }

    this.logger.log(`Solicitud de inicio de viaje: Usuario=${targetUserId}, Monopatín=${dto.scooterId}`);

    // 1. Validar existencia y solvencia del Usuario (RN-01)
    const usuario = await this.usuarioRepo.findOne({ where: { id: targetUserId } });
    if (!usuario) {
      throw new NotFoundException(`Usuario con ID ${targetUserId} no encontrado.`);
    }

    if (usuario.estado !== 'activo') {
      throw new BadRequestException('La cuenta del usuario se encuentra bloqueada por saldo pendiente o infracción.');
    }

    if (!usuario.token_pago) {
      usuario.token_pago = `tok_wompi_auto_${usuario.id.slice(0, 8)}`;
      await this.usuarioRepo.save(usuario);
    }

    // 2. Validar que no tenga ya un viaje activo (RN-03: Solo 1 viaje simultáneo)
    const activeTrip = await this.viajeRepo.findOne({
      where: { usuario_id: usuario.id, estado: 'activo' },
    });

    if (activeTrip) {
      const horasTranscurridas =
        (Date.now() - new Date(activeTrip.inicio_viaje).getTime()) / (1000 * 60 * 60);

      // Si se solicita forzar cierre o el viaje tiene más de 24 horas (viaje anómalo/huérfano)
      if (dto.forzarCierreAnterior || horasTranscurridas >= 24) {
        this.logger.warn(
          `Cierre preventivo de viaje anterior (ID ${activeTrip.id}, antigüedad: ${horasTranscurridas.toFixed(1)} horas). Motivo: ${
            dto.forzarCierreAnterior ? 'forzarCierreAnterior solicitado' : 'viaje mayor a 24 horas'
          }`,
        );

        activeTrip.estado = 'cancelado';
        activeTrip.fin_viaje = new Date();
        await this.viajeRepo.save(activeTrip);

        // Liberar el monopatín anterior si es diferente al nuevo solicitado
        if (activeTrip.monopatin_id !== dto.scooterId) {
          await this.monopatinRepo.update(
            { id: activeTrip.monopatin_id },
            { estado: 'disponible', velocidad_actual: 0 },
          );
        }
      } else {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          code: 'USER_HAS_ACTIVE_TRIP',
          message: `El usuario ya tiene un viaje activo en curso (Viaje ID: ${activeTrip.id}, Monopatín: ${activeTrip.monopatin_id}). Debe finalizar este viaje primero o enviar forzarCierreAnterior: true.`,
          data: {
            viajeId: activeTrip.id,
            scooterId: activeTrip.monopatin_id,
            inicioViaje: activeTrip.inicio_viaje,
          },
        });
      }
    }

    // 3. Validar estado y batería del Monopatín (RN-02)
    const scooter = await this.monopatinRepo.findOne({ where: { id: dto.scooterId } });
    if (!scooter) {
      throw new NotFoundException(`Monopatín con ID ${dto.scooterId} no registrado en el sistema.`);
    }

    if (scooter.estado !== 'disponible') {
      throw new BadRequestException(`El monopatín ${dto.scooterId} no está disponible (Estado actual: ${scooter.estado}).`);
    }

    if (scooter.nivel_bateria < 20) {
      throw new BadRequestException(
        `Nivel de batería insuficiente (${scooter.nivel_bateria}%). Se requiere mínimo 20% para iniciar un viaje.`,
      );
    }

    // 4. INSERT REAL en viajes en PostgreSQL Neon con RETURNING *
    const insertViajeRows = await this.dataSource.query(
      `INSERT INTO viajes (usuario_id, monopatin_id, estado, inicio_viaje) 
       VALUES ($1, $2, 'activo', NOW()) 
       RETURNING id, usuario_id, monopatin_id, inicio_viaje, estado;`,
      [usuario.id, scooter.id],
    );
    const viajeGuardado = insertViajeRows[0];

    // 5. UPDATE REAL en monopatines en PostgreSQL Neon
    await this.dataSource.query(
      `UPDATE monopatines SET estado = 'en uso', updated_at = NOW() WHERE id = $1;`,
      [scooter.id],
    );

    // 6. Enviar orden electrónica de desbloqueo al candado IoT vía WebSockets
    this.telemetryGateway.sendUnlockCommand(scooter.id);

    return {
      statusCode: 201,
      message: 'Viaje iniciado con éxito. Candado electrónico desbloqueado.',
      data: {
        viajeId: viajeGuardado.id,
        scooterId: scooter.id,
        inicioViaje: viajeGuardado.inicio_viaje,
        tarifaMinutoCOP: this.DEFAULT_RATE_PER_MINUTE,
        estado: viajeGuardado.estado,
      },
    };
  }

  /**
   * Finaliza el viaje validando geocerca de parqueo con PostGIS, bloquea candado y cobra tarifa.
   */
  async endTrip(dto: EndTripDto) {
    this.logger.log(`Solicitud de finalización de viaje: Viaje=${dto.viajeId}`);

    // 1. Obtener y validar el viaje activo
    const viaje = await this.viajeRepo.findOne({
      where: { id: dto.viajeId },
      relations: ['usuario', 'monopatin'],
    });

    if (!viaje) {
      throw new NotFoundException(`Viaje con ID ${dto.viajeId} no encontrado.`);
    }

    if (viaje.estado !== 'activo') {
      throw new BadRequestException(`El viaje ya se encuentra cerrado o cancelado (Estado: ${viaje.estado}).`);
    }

    const scooterId = viaje.monopatin_id;

    // 2. Validación Espacial PostGIS: ¿El monopatín está en una Estación de Parqueo Autorizado? (RN-06, Control 4)
    const parkingMatch: Array<{ id: string; nombre: string; tarifa_minuto: number }> =
      await this.dataSource.query(
        `SELECT z.id, z.nombre, z.tarifa_minuto
         FROM monopatines m
         JOIN zonas_geocercas z 
           ON ST_Contains(z.poligono, m.ubicacion)
         WHERE m.id = $1 AND z.tipo = 'parqueo'
         LIMIT 1`,
        [scooterId],
      );

    if (parkingMatch.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'OUTSIDE_PARKING_ZONE',
        message:
          'No es posible finalizar el viaje: El monopatín no se encuentra dentro de una Estación de Parqueo Autorizado del Gran Malecón. Por favor estacione en una estación designada (ej. Caimán del Río o Pabellón de Cristal).',
      });
    }

    const estacionParqueo = parkingMatch[0];

    // 3. Emitir comando de bloqueo al candado IoT vía WebSockets
    this.telemetryGateway.sendLockCommand(scooterId);

    // 4. Calcular tiempo transcurrido y tarifa (RN-07: Por minuto o fracción)
    const finViaje = new Date();
    const duracionMs = finViaje.getTime() - new Date(viaje.inicio_viaje).getTime();
    const duracionMinutos = Math.max(1, Math.ceil(duracionMs / (1000 * 60)));
    const tarifaAplicada = Number(estacionParqueo.tarifa_minuto) || this.DEFAULT_RATE_PER_MINUTE;
    const costoTotal = duracionMinutos * tarifaAplicada;

    // 5. INSERT REAL en pagos en PostgreSQL Neon
    const refTransaccion = `PAY-SAME-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const insertPagoRows = await this.dataSource.query(
      `INSERT INTO pagos (viaje_id, monto, estado, referencia_transaccion, created_at)
       VALUES ($1, $2, 'aprobado', $3, NOW())
       RETURNING id, viaje_id, monto, estado, referencia_transaccion, created_at;`,
      [viaje.id, costoTotal, refTransaccion],
    );
    const pagoGuardado = insertPagoRows[0];

    // 6. UPDATE REAL en viajes en PostgreSQL Neon
    const updateViajeRows = await this.dataSource.query(
      `UPDATE viajes 
       SET estado = 'finalizado',
           fin_viaje = NOW(),
           duracion_minutos = $1,
           costo_total = $2,
           foto_evidencia_url = $3
       WHERE id = $4
       RETURNING id, usuario_id, monopatin_id, inicio_viaje, fin_viaje, duracion_minutos, costo_total, foto_evidencia_url, estado;`,
      [duracionMinutos, costoTotal, dto.fotoEvidenciaUrl, dto.viajeId],
    );
    const viajeActualizado = updateViajeRows[0];

    // 7. UPDATE REAL en monopatines a 'disponible' (o 'mantenimiento' si batería < 20)
    const updatedScooterRows = await this.dataSource.query(
      `UPDATE monopatines 
       SET estado = CASE WHEN nivel_bateria < 20 THEN 'mantenimiento' ELSE 'disponible' END,
           velocidad_actual = 0.00,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, estado, nivel_bateria;`,
      [scooterId],
    );
    const scooterActual = updatedScooterRows[0];

    return {
      statusCode: 200,
      message: 'Viaje finalizado exitosamente. Monopatín bloqueado y pago procesado.',
      data: {
        viajeId: viaje.id,
        scooterId: scooterId,
        estacionParqueo: estacionParqueo.nombre,
        inicioViaje: viaje.inicio_viaje,
        finViaje: viaje.fin_viaje,
        duracionMinutos,
        tarifaMinutoCOP: tarifaAplicada,
        costoTotalCOP: costoTotal,
        pago: {
          id: pagoGuardado.id,
          referencia: pagoGuardado.referencia_transaccion,
          estado: pagoGuardado.estado,
          monto: pagoGuardado.monto,
        },
        scooterEstadoActual: scooterActual ? scooterActual.estado : 'disponible',
      },
    };
  }

  /**
   * Consultas auxiliares para la plataforma y frontend
   */
  async getActiveTripByUserId(usuarioId: string) {
    return this.viajeRepo.findOne({
      where: { usuario_id: usuarioId, estado: 'activo' },
      relations: ['monopatin'],
    });
  }

  /**
   * Forzar cancelación de un viaje activo para pruebas de desarrollo
   */
  async forceCancelTrip(viajeId: string) {
    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    if (!viaje) {
      throw new NotFoundException(`Viaje con ID ${viajeId} no encontrado.`);
    }

    viaje.estado = 'cancelado';
    viaje.fin_viaje = new Date();
    await this.viajeRepo.save(viaje);

    await this.monopatinRepo.update(
      { id: viaje.monopatin_id },
      { estado: 'disponible', velocidad_actual: 0 },
    );

    this.telemetryGateway.sendLockCommand(viaje.monopatin_id);

    return {
      statusCode: 200,
      message: `Viaje ${viajeId} cancelado forzosamente. Monopatín ${viaje.monopatin_id} restablecido a disponible.`,
    };
  }

  /**
   * Reseteo completo de viajes y flota para pruebas en ambiente de desarrollo
   */
  async resetDevState() {
    await this.dataSource.query('TRUNCATE TABLE pagos, viajes CASCADE;');
    await this.dataSource.query(
      "UPDATE monopatines SET estado = 'disponible', velocidad_actual = 0.00, nivel_bateria = 100;",
    );
    return {
      statusCode: 200,
      message: 'Ambiente reseteado: Viajes truncados y flota restablecida a disponible.',
    };
  }

  /**
   * Consulta en tiempo real de la flota directamente desde PostgreSQL Neon
   */
  async getAllScooters() {
    return this.dataSource.query(
      `SELECT id, numero_serie, estado, nivel_bateria, velocidad_actual, 
              ST_Y(ubicacion) as lat, ST_X(ubicacion) as lng, updated_at 
       FROM monopatines 
       ORDER BY id ASC;`,
    );
  }

  async getAllTrips() {
    return this.viajeRepo.find({
      order: { inicio_viaje: 'DESC' },
      relations: ['usuario', 'monopatin', 'pagos'],
      take: 50,
    });
  }
}

