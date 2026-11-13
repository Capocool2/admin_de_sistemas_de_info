// backend/src/admin/admin.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Monopatin } from '../database/entities/monopatin.entity';
import { Alerta } from '../database/entities/alerta.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { ZonaGeocerca } from '../database/entities/zona-geocerca.entity';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import {
  RelocateScooterDto,
  SendScooterNoticeDto,
  UpdateScooterStatusDto,
  UpdateUserStatusDto,
  UpdateZoneConfigDto,
} from './dto/admin.dto';

const PARKING_STATIONS: Record<'P1' | 'P2' | 'P3', { nombre: string; lat: number; lng: number }> = {
  P1: {
    nombre: 'Estación de Parqueo Puerta de Oro (P1)',
    lat: 11.0185,
    lng: -74.7955,
  },
  P2: {
    nombre: 'Estación de Parqueo Caimán del Río (P2)',
    lat: 11.0150,
    lng: -74.7925,
  },
  P3: {
    nombre: 'Estación de Parqueo Manglar (P3)',
    lat: 11.0165,
    lng: -74.7940,
  },
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Monopatin)
    private readonly monopatinRepo: Repository<Monopatin>,
    @InjectRepository(Alerta)
    private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(ZonaGeocerca)
    private readonly zonaRepo: Repository<ZonaGeocerca>,
    private readonly dataSource: DataSource,
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  /**
   * Flota completa con geocerca calculada en PostGIS, alertas pendientes y viaje activo
   */
  async getAdminFleet() {
    const rows: any[] = await this.dataSource.query(
      `SELECT m.id, m.numero_serie, m.estado, m.nivel_bateria, m.velocidad_actual,
              ST_Y(m.ubicacion) AS lat, ST_X(m.ubicacion) AS lng, m.updated_at,
              COALESCE(z.nombre, 'Fuera del Gran Malecón') AS zone_name,
              COALESCE(z.tipo, 'prohibida') AS zone_type,
              COALESCE(z.limite_velocidad, 0) AS limite_velocidad,
              (z.id IS NOT NULL AND z.tipo <> 'prohibida') AS inside_perimeter,
              COALESCE(z.tipo = 'parqueo', false) AS is_parking_zone,
              (z.id IS NULL OR z.tipo = 'prohibida') AS out_of_zone,
              v.id AS active_trip_id,
              v.inicio_viaje AS active_trip_start,
              u.id AS active_rider_id,
              u.nombre_completo AS active_rider_name,
              COALESCE(al.pending_alerts, 0)::int AS pending_alerts_count
       FROM monopatines m
       LEFT JOIN LATERAL (
         SELECT id, nombre, tipo, limite_velocidad
         FROM zonas_geocercas
         WHERE ST_Contains(poligono, m.ubicacion)
         ORDER BY CASE
           WHEN tipo = 'prohibida' THEN 1
           WHEN tipo = 'peatonal' THEN 2
           WHEN tipo = 'parqueo' THEN 3
           WHEN tipo = 'normal' THEN 4
           ELSE 5 END
         LIMIT 1
       ) z ON TRUE
       LEFT JOIN viajes v ON v.monopatin_id = m.id AND v.estado = 'activo'
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN (
         SELECT monopatin_id, COUNT(*) AS pending_alerts
         FROM alertas
         WHERE estado = 'pendiente'
         GROUP BY monopatin_id
       ) al ON al.monopatin_id = m.id
       ORDER BY m.id ASC;`,
    );

    return rows.map((row) => ({
      ...row,
      pending_maintenance: this.telemetryGateway.isPendingMaintenance(row.id),
    }));
  }

  /**
   * Cambiar estado entre disponible y mantenimiento con salvaguardas de seguridad
   */
  async updateScooterStatus(scooterId: string, dto: UpdateScooterStatusDto) {
    const scooter = await this.monopatinRepo.findOne({ where: { id: scooterId } });
    if (!scooter) {
      throw new NotFoundException(`Monopatín ${scooterId} no encontrado.`);
    }

    const activeTrips: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
      [scooterId],
    );
    const hasActiveTrip = activeTrips.length > 0;

    if (hasActiveTrip) {
      if (dto.estado === 'mantenimiento' && dto.deferIfInUse) {
        this.telemetryGateway.markPendingMaintenance(scooterId, true);
        await this.telemetryGateway.broadcastScooterSnapshot(scooterId);
        return {
          statusCode: 200,
          deferred: true,
          message: `Mantenimiento programado para ${scooterId}. Se activará automáticamente cuando el turista finalice su viaje sin interrumpir su recorrido.`,
        };
      }
      throw new BadRequestException(
        'No es seguro deshabilitar o pasar a mantenimiento un monopatín mientras un turista tiene un viaje activo. Puedes programarlo para el final del viaje.',
      );
    }

    if (dto.estado === 'disponible' && Number(scooter.nivel_bateria) < 20) {
      throw new BadRequestException(
        `El monopatín ${scooterId} tiene batería crítica (${scooter.nivel_bateria}%). Recolócalo o recárgalo antes de habilitarlo para turistas.`,
      );
    }

    // Si estaba bloqueado fuera de perímetro, impedir marcar disponible en zona prohibida
    if (dto.estado === 'disponible') {
      const geoRows: Array<{ inside_perimeter: boolean }> = await this.dataSource.query(
        `SELECT EXISTS (
           SELECT 1 FROM zonas_geocercas z, monopatines m
           WHERE m.id = $1 AND z.tipo <> 'prohibida' AND ST_Contains(z.poligono, m.ubicacion)
         ) AS inside_perimeter;`,
        [scooterId],
      );
      if (!geoRows[0]?.inside_perimeter) {
        throw new BadRequestException(
          `El monopatín ${scooterId} está fuera del perímetro autorizado. Usa "Recolocar en Estación" para devolverlo al Gran Malecón.`,
        );
      }
    }

    await this.dataSource.query(
      `UPDATE monopatines
       SET estado = $1,
           velocidad_actual = 0.00,
           updated_at = NOW()
       WHERE id = $2;`,
      [dto.estado, scooterId],
    );

    this.telemetryGateway.markPendingMaintenance(scooterId, false);
    await this.telemetryGateway.broadcastScooterSnapshot(scooterId);

    this.logger.log(`Operador cambió estado de ${scooterId} -> ${dto.estado}`);
    return {
      statusCode: 200,
      deferred: false,
      message: `Monopatín ${scooterId} actualizado a estado "${dto.estado}".`,
    };
  }

  /**
   * Recolocar logísticamente una unidad (sin viaje activo en curso) a una estación P1/P2/P3
   */
  async relocateScooter(scooterId: string, dto: RelocateScooterDto) {
    const scooter = await this.monopatinRepo.findOne({ where: { id: scooterId } });
    if (!scooter) {
      throw new NotFoundException(`Monopatín ${scooterId} no encontrado.`);
    }

    const station = PARKING_STATIONS[dto.stationId];
    if (!station) {
      throw new BadRequestException(`Estación ${dto.stationId} no válida.`);
    }

    const activeTrips: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
      [scooterId],
    );
    if (activeTrips.length > 0) {
      throw new BadRequestException(
        `El monopatín ${scooterId} tiene un viaje activo pendiente de cierre (ID: ${activeTrips[0].id}). Finaliza o cierra primero ese viaje si quedó bloqueado fuera de zona.`,
      );
    }

    const recharge = dto.rechargeBattery !== false;
    const targetBattery = recharge ? 100 : Math.max(Number(scooter.nivel_bateria) || 0, 0);
    const nextEstado = targetBattery < 20 ? 'mantenimiento' : 'disponible';

    await this.dataSource.query(
      `UPDATE monopatines
       SET estado = $1,
           velocidad_actual = 0.00,
           nivel_bateria = $2,
           ubicacion = ST_SetSRID(ST_MakePoint($3, $4), 4326),
           updated_at = NOW()
       WHERE id = $5;`,
      [nextEstado, targetBattery, station.lng, station.lat, scooterId],
    );

    // Marcar como atendidas las alertas abiertas de esta unidad al haber sido recogida
    await this.dataSource.query(
      `UPDATE alertas SET estado = 'atendida' WHERE monopatin_id = $1 AND estado = 'pendiente';`,
      [scooterId],
    );

    await this.telemetryGateway.notifyScooterRelocated(
      scooterId,
      station.lat,
      station.lng,
      targetBattery,
    );
    this.telemetryGateway.notifyAlertsChanged();

    return {
      statusCode: 200,
      message: `${scooterId} recolocado en ${station.nombre}${recharge ? ' con batería al 100%' : ''}.`,
    };
  }

  /**
   * Liberar bloqueo de emergencia/alarma si el monopatín ya se encuentra dentro de zona permitida
   */
  async clearScooterLock(scooterId: string) {
    const rows: any[] = await this.dataSource.query(
      `SELECT m.id, m.estado, m.nivel_bateria,
              ST_Y(m.ubicacion) AS lat, ST_X(m.ubicacion) AS lng,
              EXISTS (
                SELECT 1 FROM zonas_geocercas z
                WHERE z.tipo <> 'prohibida' AND ST_Contains(z.poligono, m.ubicacion)
              ) AS inside_perimeter
       FROM monopatines m
       WHERE m.id = $1
       LIMIT 1;`,
      [scooterId],
    );
    const scooter = rows[0];
    if (!scooter) {
      throw new NotFoundException(`Monopatín ${scooterId} no encontrado.`);
    }

    if (!scooter.inside_perimeter) {
      throw new BadRequestException(
        `El monopatín ${scooterId} sigue fuera del perímetro autorizado del Gran Malecón. Usa "Recolocar en Estación" para devolverlo a zona segura.`,
      );
    }

    const activeTrips: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
      [scooterId],
    );
    const hasActiveTrip = activeTrips.length > 0;
    const battery = Number(scooter.nivel_bateria) || 0;
    const nextEstado = hasActiveTrip
      ? 'en uso'
      : battery < 20
      ? 'mantenimiento'
      : 'disponible';

    await this.dataSource.query(
      `UPDATE monopatines
       SET estado = $1,
           velocidad_actual = 0.00,
           updated_at = NOW()
       WHERE id = $2;`,
      [nextEstado, scooterId],
    );

    await this.dataSource.query(
      `UPDATE alertas
       SET estado = 'atendida'
       WHERE monopatin_id = $1 AND estado = 'pendiente' AND tipo_alerta IN ('fuera_perimetro', 'robo');`,
      [scooterId],
    );

    await this.telemetryGateway.notifyClearAlarmLock(
      scooterId,
      !hasActiveTrip,
      Number(scooter.lat),
      Number(scooter.lng),
      battery,
    );
    this.telemetryGateway.notifyAlertsChanged();

    return {
      statusCode: 200,
      message: hasActiveTrip
        ? `Alarma liberada en ${scooterId}. El turista puede continuar su recorrido con seguridad.`
        : `Bloqueo retirado en ${scooterId} (Estado actual: ${nextEstado}).`,
    };
  }

  /**
   * Enviar aviso preventivo en vivo a la app del turista que conduce esa unidad
   */
  async sendScooterNotice(scooterId: string, dto: SendScooterNoticeDto, adminName?: string) {
    const activeTrips: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
      [scooterId],
    );
    if (activeTrips.length === 0) {
      throw new BadRequestException(
        `El monopatín ${scooterId} no tiene ningún turista con viaje activo en este momento.`,
      );
    }

    this.telemetryGateway.sendOperatorNotice(scooterId, dto.message.trim(), adminName);
    return {
      statusCode: 200,
      message: `Aviso enviado en tiempo real al turista en ${scooterId}.`,
    };
  }

  /**
   * Consultar alertas persistentes en PostgreSQL
   */
  async getAlerts(estado?: string) {
    const filter = estado && ['pendiente', 'atendida'].includes(estado) ? estado : null;
    const rows = await this.dataSource.query(
      `SELECT id, monopatin_id, tipo_alerta, estado, created_at,
              ST_Y(ubicacion) AS lat, ST_X(ubicacion) AS lng
       FROM alertas
       WHERE ($1::varchar IS NULL OR estado = $1)
       ORDER BY (estado = 'pendiente') DESC, created_at DESC
       LIMIT 100;`,
      [filter],
    );

    const pendingCountRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM alertas WHERE estado = 'pendiente';`,
    );

    return {
      alerts: rows,
      pendingCount: pendingCountRows[0]?.total || 0,
    };
  }

  async attendAlert(alertId: string) {
    const alert = await this.alertaRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException(`Alerta ${alertId} no encontrada.`);
    }

    await this.dataSource.query(`UPDATE alertas SET estado = 'atendida' WHERE id = $1;`, [alertId]);
    this.telemetryGateway.notifyAlertsChanged();

    return {
      statusCode: 200,
      message: `Alerta ${alertId} marcada como atendida.`,
    };
  }

  /**
   * Gestión de cuentas de turistas y estadísticas de uso (sin exponer credenciales)
   */
  async getUsers() {
    return this.dataSource.query(
      `SELECT u.id, u.nombre_completo, u.documento_identidad, u.correo, u.telefono,
              u.estado, u.rol, u.created_at,
              COUNT(v.id)::int AS total_viajes,
              COUNT(*) FILTER (WHERE v.estado = 'activo')::int AS viajes_activos,
              COALESCE(SUM(v.costo_total), 0)::numeric AS gasto_total
       FROM usuarios u
       LEFT JOIN viajes v ON v.usuario_id = u.id
       GROUP BY u.id
       ORDER BY (u.rol = 'admin') DESC, u.created_at DESC;`,
    );
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    currentAdminId?: string,
  ) {
    const user = await this.usuarioRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario ${userId} no encontrado.`);
    }

    if (user.rol === 'admin') {
      throw new BadRequestException('No es posible bloquear una cuenta con rol de administrador.');
    }

    if (currentAdminId && user.id === currentAdminId) {
      throw new BadRequestException('No puedes modificar el estado de tu propia cuenta.');
    }

    if (dto.estado === 'bloqueado') {
      const activeTrips: Array<{ id: string }> = await this.dataSource.query(
        `SELECT id FROM viajes WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1;`,
        [userId],
      );
      if (activeTrips.length > 0) {
        throw new BadRequestException(
          'El turista tiene un viaje activo en curso. Espera a que finalice antes de suspender su cuenta.',
        );
      }
    }

    await this.dataSource.query(`UPDATE usuarios SET estado = $1 WHERE id = $2;`, [
      dto.estado,
      userId,
    ]);

    return {
      statusCode: 200,
      message: `Cuenta de ${user.nombre_completo} actualizada a "${dto.estado}".`,
    };
  }

  /**
   * Zonas PostGIS, límites de velocidad y tarifa para viajes nuevos
   */
  async getZones() {
    return this.dataSource.query(
      `SELECT id, nombre, tipo, limite_velocidad, tarifa_minuto
       FROM zonas_geocercas
       ORDER BY CASE
         WHEN tipo = 'normal' THEN 1
         WHEN tipo = 'peatonal' THEN 2
         WHEN tipo = 'parqueo' THEN 3
         ELSE 4 END, nombre ASC;`,
    );
  }

  async updateZone(zoneId: string, dto: UpdateZoneConfigDto) {
    const zone = await this.zonaRepo.findOne({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zona geocerca ${zoneId} no encontrada.`);
    }

    const nextSpeed =
      typeof dto.limite_velocidad === 'number' ? dto.limite_velocidad : zone.limite_velocidad;
    const nextRate =
      typeof dto.tarifa_minuto === 'number' ? dto.tarifa_minuto : Number(zone.tarifa_minuto);

    await this.dataSource.query(
      `UPDATE zonas_geocercas
       SET limite_velocidad = $1,
           tarifa_minuto = $2
       WHERE id = $3;`,
      [nextSpeed, nextRate, zoneId],
    );

    if (dto.applyRateToAllZones && typeof dto.tarifa_minuto === 'number') {
      await this.dataSource.query(
        `UPDATE zonas_geocercas SET tarifa_minuto = $1 WHERE tipo IN ('normal', 'peatonal', 'parqueo');`,
        [nextRate],
      );
    }

    this.telemetryGateway.notifyZonesUpdated();

    return {
      statusCode: 200,
      message: `Reglas de "${zone.nombre}" actualizadas (aplica a telemetría vigente y viajes nuevos).`,
    };
  }

  /**
   * Resumen financiero y operativo de la Torre de Control
   */
  async getSummary() {
    const rows = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM viajes) AS total_viajes,
         (SELECT COUNT(*)::int FROM viajes WHERE estado = 'activo') AS viajes_activos,
         (SELECT COUNT(*)::int FROM viajes WHERE estado = 'finalizado') AS viajes_finalizados,
         (SELECT COALESCE(SUM(monto), 0)::numeric FROM pagos WHERE estado = 'aprobado') AS ingresos_totales,
         (SELECT COUNT(*)::int FROM pagos WHERE referencia_transaccion LIKE 'PAY-PENALTY%' OR referencia_transaccion LIKE 'PAY-ABANDON%') AS multas_aplicadas,
         (SELECT COUNT(*)::int FROM alertas WHERE estado = 'pendiente') AS alertas_pendientes;`,
    );
    return rows[0];
  }
}

