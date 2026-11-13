// backend/src/telemetry/telemetry.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { TelemetryUpdateDto } from './dto/telemetry-update.dto';

const SAFE_MALECON_WAYPOINTS = [
  { lat: 11.0182, lng: -74.7952, desc: 'Estación Puerta de Oro (P1)' },
  { lat: 11.0175, lng: -74.7944, desc: 'Ciclorruta Avenida del Río' },
  { lat: 11.0168, lng: -74.7938, desc: 'Paseo Peatonal Caimán del Río' },
  { lat: 11.0158, lng: -74.7935, desc: 'Sector Gastronómico' },
  { lat: 11.0150, lng: -74.7925, desc: 'Estación Caimán del Río (P2)' },
  { lat: 11.0165, lng: -74.7940, desc: 'Estación Manglar (P3)' },
  { lat: 11.0172, lng: -74.7948, desc: 'Ciclorruta Norte Malecón' },
  { lat: 11.0145, lng: -74.7918, desc: 'Ciclorruta Sur Malecón' },
];

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TelemetryGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelemetryGateway.name);
  private readonly idleOutsideSince = new Map<string, number>();
  private readonly lastPerimeterAlertAt = new Map<string, number>();
  private readonly lastRobberyAlertAt = new Map<string, number>();
  private readonly lastLowBatteryAlertAt = new Map<string, number>();
  private readonly simulatorClientScooters = new Map<string, string>(); // socket.id -> scooterId
  private readonly manualControlScooters = new Set<string>();
  private readonly pendingMaintenanceScooters = new Set<string>();
  private readonly fallbackRandomTimers = new Map<string, NodeJS.Timeout>();
  private readonly fallbackPositions = new Map<
    string,
    { lat: number; lng: number; battery: number; targetIdx: number }
  >();
  private readonly ABANDONMENT_PENALTY_COP = 15000;
  private readonly AUTO_ABANDON_IDLE_MS = 30000;

  constructor(private readonly dataSource: DataSource) {}

  afterInit() {
    this.logger.log('🛰️ Telemetry WebSocket Gateway inicializado con Socket.io');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.simulatorClientScooters.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  private extractFirstRow<T>(result: unknown): T | undefined {
    if (!Array.isArray(result) || result.length === 0) return undefined;
    const first = result[0];
    // En TypeORM + PostgreSQL, UPDATE/DELETE ... RETURNING devuelve [rows, rowCount]
    return Array.isArray(first) ? (first[0] as T | undefined) : (first as T | undefined);
  }

  private hasExternalSimulator(scooterId: string): boolean {
    for (const sid of this.simulatorClientScooters.values()) {
      if (sid === scooterId) return true;
    }
    return false;
  }

  private stopFallbackRandom(scooterId: string) {
    const timer = this.fallbackRandomTimers.get(scooterId);
    if (timer) {
      clearInterval(timer);
      this.fallbackRandomTimers.delete(scooterId);
    }
  }

  private startFallbackRandom(
    scooterId: string,
    startLat: number,
    startLng: number,
    startBattery: number,
  ) {
    this.stopFallbackRandom(scooterId);
    const targetIdx = Math.floor(Math.random() * SAFE_MALECON_WAYPOINTS.length);
    this.fallbackPositions.set(scooterId, {
      lat: startLat,
      lng: startLng,
      battery: startBattery,
      targetIdx,
    });

    const timer = setInterval(async () => {
      if (this.manualControlScooters.has(scooterId)) {
        this.stopFallbackRandom(scooterId);
        return;
      }
      const pos = this.fallbackPositions.get(scooterId);
      if (!pos) {
        this.stopFallbackRandom(scooterId);
        return;
      }

      const target = SAFE_MALECON_WAYPOINTS[pos.targetIdx];
      const dLat = target.lat - pos.lat;
      const dLng = target.lng - pos.lng;
      const dist = Math.hypot(dLat, dLng);
      const step = 0.00055;

      if (dist <= step) {
        pos.lat = target.lat;
        pos.lng = target.lng;
        pos.targetIdx = Math.floor(Math.random() * SAFE_MALECON_WAYPOINTS.length);
      } else {
        pos.lat += (dLat / dist) * step;
        pos.lng += (dLng / dist) * step;
      }
      pos.battery = Math.max(0, Number((pos.battery - 0.1).toFixed(2)));
      const speed = Number((12 + Math.random() * 7).toFixed(1));

      await this.processTelemetry({
        scooterId,
        lat: pos.lat,
        lng: pos.lng,
        speed,
        battery: Math.round(pos.battery),
        locked: false,
      });
    }, 3000);

    this.fallbackRandomTimers.set(scooterId, timer);
  }

  /**
   * Permite a los clientes suscribirse a salas de interés:
   * - 'scooters': Dispositivos IoT / Simuladores
   * - 'dashboard': Panel de monitoreo administrativo y mapas en vivo
   * - 'client_trips': Usuarios móviles siguiendo su viaje
   */
  @SubscribeMessage('join:room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { room: string; scooterId?: string },
  ) {
    if (payload?.room) {
      client.join(payload.room);
      this.logger.log(`Cliente ${client.id} se unió a la sala '${payload.room}'`);
    }
    if (payload?.scooterId) {
      const scooterRoom = `scooter_${payload.scooterId}`;
      client.join(scooterRoom);
      if (payload?.room === 'scooters') {
        this.simulatorClientScooters.set(client.id, payload.scooterId);
        this.stopFallbackRandom(payload.scooterId);
      }
      this.logger.log(`Cliente ${client.id} asignado a canal monopatín '${scooterRoom}'`);
    }
    return { status: 'ok', joined: payload?.room };
  }

  /**
   * Alterna entre modo de control manual (WASD / Joystick) y simulación automática aleatoria.
   */
  @SubscribeMessage('simulator:control_mode')
  async handleControlMode(
    @MessageBody()
    payload: {
      scooterId: string;
      manual: boolean;
      lat?: number;
      lng?: number;
      battery?: number;
      speed?: number;
      locked?: boolean;
    },
  ) {
    const { scooterId, manual, lat, lng, battery, speed, locked } = payload || {};
    if (!scooterId) return { status: 'error', message: 'scooterId requerido' };

    if (manual) {
      this.manualControlScooters.add(scooterId);
      this.stopFallbackRandom(scooterId);
      this.idleOutsideSince.delete(scooterId);
      this.logger.log(`🎮 Control manual ACTIVADO para ${scooterId} (simulación aleatoria detenida)`);
    } else {
      this.manualControlScooters.delete(scooterId);
      this.idleOutsideSince.delete(scooterId);
      this.logger.log(`🔀 Control manual FINALIZADO para ${scooterId} (reanudando simulación aleatoria)`);

      if (!this.hasExternalSimulator(scooterId) && !locked) {
        const rows = await this.dataSource.query(
          `SELECT estado, ST_Y(ubicacion) as lat, ST_X(ubicacion) as lng, nivel_bateria
           FROM monopatines WHERE id = $1 LIMIT 1;`,
          [scooterId],
        );
        const sc = rows[0];
        if (sc && sc.estado === 'en uso') {
          this.startFallbackRandom(
            scooterId,
            lat ?? Number(sc.lat) ?? 11.0175,
            lng ?? Number(sc.lng) ?? -74.7944,
            battery ?? Number(sc.nivel_bateria) ?? 85,
          );
        }
      }
    }

    this.server.to(`scooter_${scooterId}`).to('scooters').emit('simulator:control_mode', {
      scooterId,
      manual,
      lat,
      lng,
      battery,
      speed,
      locked,
    });

    return { status: 'ok', scooterId, manual };
  }

  /**
   * Recibe telemetría en tiempo real desde el monopatín, simulador o control manual.
   * Ejecuta verificaciones de seguridad espacial (PostGIS) y estado.
   */
  @SubscribeMessage('telemetry:update')
  async handleTelemetryUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TelemetryUpdateDto,
  ) {
    return this.processTelemetry(data);
  }

  private async processTelemetry(data: TelemetryUpdateDto) {
    try {
      const { scooterId, lat, lng, speed, battery, locked } = data;

      // 1. Verificación Espacial con PostGIS (Geofencing)
      const zones: Array<{ id: string; nombre: string; tipo: string; limite_velocidad: number }> =
        await this.dataSource.query(
          `SELECT id, nombre, tipo, limite_velocidad 
           FROM zonas_geocercas 
           WHERE ST_Contains(poligono, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           ORDER BY CASE 
             WHEN tipo = 'prohibida' THEN 1
             WHEN tipo = 'peatonal' THEN 2
             WHEN tipo = 'parqueo' THEN 3
             WHEN tipo = 'normal' THEN 4
             ELSE 5 END`,
          [lng, lat],
        );

      const isOutOfPerimeter = zones.length === 0 || zones[0].tipo === 'prohibida';
      const isInsideParkingZone = zones.some((z) => z.tipo === 'parqueo');

      let currentZoneName = 'Fuera del Gran Malecón';
      let currentZoneType: 'normal' | 'peatonal' | 'parqueo' | 'prohibida' = 'prohibida';
      let maxSpeed = 0;

      if (!isOutOfPerimeter) {
        const topZone = zones[0];
        currentZoneName = topZone.nombre;
        currentZoneType = topZone.tipo as 'normal' | 'peatonal' | 'parqueo';
        maxSpeed =
          Number(topZone.limite_velocidad) ||
          (topZone.tipo === 'peatonal' || topZone.tipo === 'parqueo' ? 10 : 20);
      }

      // 2. Persistencia estricta en Neon PostgreSQL con PostGIS y obtención del estado real
      let updatedRows: Array<{ estado: string }> = [];
      if (isOutOfPerimeter) {
        updatedRows = await this.dataSource.query(
          `UPDATE monopatines
           SET estado = 'bloqueado',
               nivel_bateria = $1,
               velocidad_actual = 0.00,
               ubicacion = ST_SetSRID(ST_MakePoint($2, $3), 4326),
               updated_at = NOW()
           WHERE id = $4
           RETURNING estado;`,
          [battery, lng, lat, scooterId],
        );
      } else {
        updatedRows = await this.dataSource.query(
          `UPDATE monopatines
           SET nivel_bateria = $1,
               velocidad_actual = CASE
                 WHEN estado IN ('bloqueado', 'mantenimiento') THEN 0.00
                 ELSE $2
               END,
               ubicacion = ST_SetSRID(ST_MakePoint($3, $4), 4326),
               updated_at = NOW()
           WHERE id = $5
           RETURNING estado;`,
          [battery, locked ? 0 : Math.max(0, Math.min(Number(speed) || 0, maxSpeed)), lng, lat, scooterId],
        );
      }

      const updatedRow = this.extractFirstRow<{
        estado: 'disponible' | 'en uso' | 'mantenimiento' | 'bloqueado';
      }>(updatedRows);

      const dbEstado = (updatedRow?.estado ||
        (isOutOfPerimeter ? 'bloqueado' : locked ? 'disponible' : 'en uso')) as
        | 'disponible'
        | 'en uso'
        | 'mantenimiento'
        | 'bloqueado';

      const effectiveLocked = Boolean(
        locked ||
          isOutOfPerimeter ||
          dbEstado === 'bloqueado' ||
          dbEstado === 'mantenimiento',
      );
      const effectiveSpeed = effectiveLocked
        ? 0
        : Math.max(0, Math.min(Number(speed) || 0, maxSpeed));

      // 3. Control Antirrobo: Movimiento no autorizado con candado bloqueado
      if (locked && speed > 2.0) {
        this.logger.warn(`🚨 Robo detectado: Monopatín ${scooterId} en movimiento (${speed} km/h) estando bloqueado!`);

        const now = Date.now();
        const lastAlert = this.lastRobberyAlertAt.get(scooterId) || 0;
        if (now - lastAlert > 10000) {
          this.lastRobberyAlertAt.set(scooterId, now);
          const inserted = await this.dataSource.query(
            `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
             VALUES ($1, 'robo', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
             RETURNING id`,
            [scooterId, lng, lat],
          );

          this.server.to('dashboard').emit('alert:security', {
            alertId: inserted[0]?.id,
            type: 'robo',
            scooterId,
            lat,
            lng,
            speed,
            status: 'pendiente',
            timestamp: new Date().toISOString(),
            message: `¡ALERTA DE ROBO! Monopatín ${scooterId} en movimiento no autorizado.`,
          });
        }

        this.server
          .to(`scooter_${scooterId}`)
          .to('scooters')
          .to('client_trips')
          .emit('scooter:emergency_stop', {
            scooterId,
            type: 'robo',
            reason: 'Movimiento no autorizado detectado en vehículo bloqueado (Alerta de Hurto)',
          });
      }

      // 4. Control de Batería Crítica (< 15%) con registro persistente sin duplicados
      if (battery < 15) {
        const now = Date.now();
        const lastLowBat = this.lastLowBatteryAlertAt.get(scooterId) || 0;
        if (now - lastLowBat > 60000) {
          this.lastLowBatteryAlertAt.set(scooterId, now);
          const existingBat = await this.dataSource.query(
            `SELECT id FROM alertas WHERE monopatin_id = $1 AND tipo_alerta = 'bateria_baja' AND estado = 'pendiente' LIMIT 1;`,
            [scooterId],
          );
          let batAlertId = existingBat[0]?.id;
          if (!batAlertId) {
            const insertedBat = await this.dataSource.query(
              `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
               VALUES ($1, 'bateria_baja', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
               RETURNING id;`,
              [scooterId, lng, lat],
            );
            batAlertId = insertedBat[0]?.id;
          }

          this.server.to('dashboard').emit('alert:maintenance', {
            alertId: batAlertId,
            type: 'bateria_baja',
            scooterId,
            battery,
            lat,
            lng,
            status: 'pendiente',
            timestamp: new Date().toISOString(),
            message: `Monopatín ${scooterId} con batería crítica (${battery}%). Requiere recarga.`,
          });
        }
      }

      // 5. Acciones por Geocerca (Perímetro / Velocidad)
      if (isOutOfPerimeter) {
        this.logger.warn(`⚠️ Monopatín ${scooterId} FUERA DEL PERÍMETRO AUTORIZADO (Lat: ${lat}, Lng: ${lng})`);
        this.stopFallbackRandom(scooterId);
        this.manualControlScooters.delete(scooterId);

        const now = Date.now();
        const lastAlert = this.lastPerimeterAlertAt.get(scooterId) || 0;
        if (now - lastAlert > 10000) {
          this.lastPerimeterAlertAt.set(scooterId, now);
          const insertedPerim = await this.dataSource.query(
            `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
             VALUES ($1, 'fuera_perimetro', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
             RETURNING id`,
            [scooterId, lng, lat],
          );

          this.server.to('dashboard').emit('alert:security', {
            alertId: insertedPerim[0]?.id,
            type: 'fuera_perimetro',
            scooterId,
            lat,
            lng,
            speed: 0,
            status: 'pendiente',
            timestamp: new Date().toISOString(),
            message: `¡INFRACCIÓN DE PERÍMETRO! Monopatín ${scooterId} salió del Gran Malecón. Motor apagado, candado cerrado y alarma 85 dB activada.`,
          });
        }

        this.server
          .to(`scooter_${scooterId}`)
          .to('scooters')
          .to('client_trips')
          .emit('scooter:emergency_stop', {
            scooterId,
            type: 'fuera_perimetro',
            reason: 'Límite perimetral excedido. Motor apagado, candado cerrado y alarma 85 dB encendida.',
          });
      } else if (!effectiveLocked) {
        const speedReason =
          currentZoneType === 'peatonal'
            ? 'Zona Peatonal de alta afluencia (Gran Malecón)'
            : currentZoneType === 'parqueo'
            ? 'Estación de Parqueo Autorizado'
            : 'Ciclorruta Gran Malecón';

        this.server
          .to(`scooter_${scooterId}`)
          .to('client_trips')
          .emit('scooter:set_speed_limit', {
            scooterId,
            maxSpeed,
            zoneName: currentZoneName,
            zoneType: currentZoneType,
            reason: speedReason,
          });
      }

      // 6. Detección automática de abandono por inactividad (>= 30s) fuera de estación de parqueo
      if (!effectiveLocked && effectiveSpeed <= 0.5 && !isInsideParkingZone) {
        const since = this.idleOutsideSince.get(scooterId);
        const now = Date.now();
        if (!since) {
          this.idleOutsideSince.set(scooterId, now);
        } else if (now - since >= this.AUTO_ABANDON_IDLE_MS) {
          this.idleOutsideSince.delete(scooterId);
          await this.handleAutoAbandonedScooter(scooterId, lat, lng);
        }
      } else {
        this.idleOutsideSince.delete(scooterId);
      }

      // 7. Retransmisión de telemetría a salas de dashboard y clientes móviles
      const broadcastPayload = {
        scooterId,
        lat,
        lng,
        speed: effectiveSpeed,
        battery,
        locked: effectiveLocked,
        estado: dbEstado,
        zoneName: currentZoneName,
        zoneType: currentZoneType,
        maxSpeed,
        isInsideParkingZone,
        outOfPerimeter: isOutOfPerimeter,
        emergencyStopped: isOutOfPerimeter || dbEstado === 'bloqueado',
        pendingMaintenance: this.pendingMaintenanceScooters.has(scooterId),
        timestamp: new Date().toISOString(),
      };

      this.server.to('dashboard').to('client_trips').emit('telemetry:broadcast', broadcastPayload);

      return { status: 'acknowledged', zone: currentZoneName, maxSpeed };
    } catch (error) {
      this.logger.error(`Error procesando telemetría para ${data?.scooterId}:`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Cierre automático y sanción cuando un monopatín queda abandonado e inmóvil fuera de estación
   */
  private async handleAutoAbandonedScooter(scooterId: string, lat: number, lng: number) {
    this.logger.warn(`⚠️ Abandono por inactividad detectado en monopatín ${scooterId} fuera de estación`);
    this.stopFallbackRandom(scooterId);
    this.manualControlScooters.delete(scooterId);

    const activeTrips = await this.dataSource.query(
      `SELECT id, inicio_viaje FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
      [scooterId],
    );

    if (activeTrips.length === 0) {
      return;
    }

    const activeTrip = activeTrips[0];
    const duracionMs = Date.now() - new Date(activeTrip.inicio_viaje).getTime();
    const duracionMinutos = Math.max(1, Math.ceil(duracionMs / (1000 * 60)));
    const costoTotal = duracionMinutos * 500 + this.ABANDONMENT_PENALTY_COP;
    const refTransaccion = `PAY-ABANDON-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    await this.dataSource.query(
      `INSERT INTO pagos (viaje_id, monto, estado, referencia_transaccion, created_at)
       VALUES ($1, $2, 'aprobado', $3, NOW());`,
      [activeTrip.id, costoTotal, refTransaccion],
    );

    await this.dataSource.query(
      `UPDATE viajes SET estado = 'finalizado', fin_viaje = NOW(), duracion_minutos = $1, costo_total = $2
       WHERE id = $3;`,
      [duracionMinutos, costoTotal, activeTrip.id],
    );

    await this.dataSource.query(
      `UPDATE monopatines SET estado = 'bloqueado', velocidad_actual = 0.00, updated_at = NOW() WHERE id = $1;`,
      [scooterId],
    );

    await this.notifyAbandonedScooter(
      scooterId,
      lat,
      lng,
      this.ABANDONMENT_PENALTY_COP,
      'Abandono por inactividad fuera de estación autorizada',
    );

    this.pendingMaintenanceScooters.delete(scooterId);
    await this.broadcastScooterSnapshot(scooterId);

    this.server.to('client_trips').emit('trip:auto_abandoned', {
      scooterId,
      viajeId: activeTrip.id,
      multaCOP: this.ABANDONMENT_PENALTY_COP,
      costoTotalCOP: costoTotal,
      message: `Viaje cerrado automáticamente por inactividad prolongada fuera de estación. Se aplicó multa de $${this.ABANDONMENT_PENALTY_COP.toLocaleString('es-CO')} COP y bloqueo remoto.`,
    });
  }

  markPendingMaintenance(scooterId: string, pending: boolean) {
    if (pending) {
      this.pendingMaintenanceScooters.add(scooterId);
    } else {
      this.pendingMaintenanceScooters.delete(scooterId);
    }
  }

  isPendingMaintenance(scooterId: string): boolean {
    return this.pendingMaintenanceScooters.has(scooterId);
  }

  /**
   * Limpia temporizadores y estado de control al finalizar/cancelar un viaje
   */
  clearScooterRuntime(scooterId: string) {
    this.stopFallbackRandom(scooterId);
    this.manualControlScooters.delete(scooterId);
    this.idleOutsideSince.delete(scooterId);
    this.lastPerimeterAlertAt.delete(scooterId);
    this.lastRobberyAlertAt.delete(scooterId);
    this.lastLowBatteryAlertAt.delete(scooterId);
  }

  /**
   * Restablece simuladores y estado en memoria al usar reset-dev
   */
  resetAllRuntimes() {
    for (const timer of this.fallbackRandomTimers.values()) {
      clearInterval(timer);
    }
    this.fallbackRandomTimers.clear();
    this.fallbackPositions.clear();
    this.manualControlScooters.clear();
    this.pendingMaintenanceScooters.clear();
    this.idleOutsideSince.clear();
    this.lastPerimeterAlertAt.clear();
    this.lastRobberyAlertAt.clear();
    this.lastLowBatteryAlertAt.clear();

    this.server.to('scooters').to('client_trips').to('dashboard').emit('scooter:reset', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Registra alerta y emite bloqueo remoto + notificación de abandono al Centro de Control
   */
  async notifyAbandonedScooter(
    scooterId: string,
    lat: number,
    lng: number,
    multaCOP: number,
    reason: string,
  ) {
    let alertId: string | undefined;
    try {
      const inserted = await this.dataSource.query(
        `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
         VALUES ($1, 'fuera_perimetro', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
         RETURNING id`,
        [scooterId, lng, lat],
      );
      alertId = inserted[0]?.id;
    } catch (err) {
      this.logger.warn(`No se pudo insertar alerta de abandono en BD: ${err.message}`);
    }

    this.sendLockCommand(scooterId);
    this.sendEmergencyStop(
      scooterId,
      `${reason}. Candado bloqueado a distancia y multa de $${multaCOP.toLocaleString('es-CO')} COP aplicada.`,
    );

    this.server.to('dashboard').emit('alert:security', {
      alertId,
      type: 'abandono',
      scooterId,
      lat,
      lng,
      speed: 0,
      status: 'pendiente',
      timestamp: new Date().toISOString(),
      message: `¡MONOPATÍN ABANDONADO! ${scooterId} dejado fuera de estación. Bloqueado a distancia y multa ($${multaCOP.toLocaleString('es-CO')} COP) cobrada. Requiere recogida logística.`,
    });
  }

  /**
   * Emite fotografía actualizada de un monopatín desde Neon PostgreSQL + PostGIS
   */
  async broadcastScooterSnapshot(scooterId: string) {
    try {
      const rows: any[] = await this.dataSource.query(
        `SELECT m.id, m.estado, m.nivel_bateria, m.velocidad_actual,
                ST_Y(m.ubicacion) AS lat, ST_X(m.ubicacion) AS lng, m.updated_at,
                z.nombre AS zone_name, z.tipo AS zone_type, z.limite_velocidad,
                (z.id IS NOT NULL AND z.tipo <> 'prohibida') AS inside_perimeter,
                COALESCE(z.tipo = 'parqueo', false) AS is_parking_zone
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
         WHERE m.id = $1
         LIMIT 1;`,
        [scooterId],
      );

      const sc = rows[0];
      if (!sc) return;

      const outOfPerimeter = !sc.inside_perimeter || sc.zone_type === 'prohibida';
      const maxSpeed = outOfPerimeter
        ? 0
        : Number(sc.limite_velocidad) ||
          (sc.zone_type === 'peatonal' || sc.zone_type === 'parqueo' ? 10 : 20);

      const payload = {
        scooterId: sc.id,
        lat: Number(sc.lat) || 11.0182,
        lng: Number(sc.lng) || -74.7952,
        speed: Number(sc.velocidad_actual) || 0,
        battery: Number(sc.nivel_bateria) ?? 100,
        locked: sc.estado !== 'en uso',
        estado: sc.estado,
        zoneName: outOfPerimeter ? 'Fuera del Gran Malecón' : sc.zone_name || 'Gran Malecón',
        zoneType: outOfPerimeter ? 'prohibida' : sc.zone_type || 'normal',
        maxSpeed,
        isInsideParkingZone: Boolean(sc.is_parking_zone),
        outOfPerimeter,
        emergencyStopped: outOfPerimeter || sc.estado === 'bloqueado',
        pendingMaintenance: this.pendingMaintenanceScooters.has(sc.id),
        timestamp: new Date().toISOString(),
      };

      this.server.to('dashboard').to('client_trips').emit('telemetry:broadcast', payload);
    } catch (err) {
      this.logger.warn(`No se pudo emitir snapshot de ${scooterId}: ${err.message}`);
    }
  }

  /**
   * Notifica al hardware/simulador y mapas que el operador recolocó/recargó la unidad
   */
  async notifyScooterRelocated(
    scooterId: string,
    lat: number,
    lng: number,
    battery: number,
  ) {
    this.clearScooterRuntime(scooterId);
    this.pendingMaintenanceScooters.delete(scooterId);

    const payload = {
      scooterId,
      lat,
      lng,
      battery,
      locked: true,
      timestamp: new Date().toISOString(),
    };
    this.server.to(`scooter_${scooterId}`).to('scooters').to('client_trips').emit('scooter:relocated', payload);
    await this.broadcastScooterSnapshot(scooterId);
  }

  /**
   * Notifica liberación de alarma o bloqueo desde el Centro de Control
   */
  async notifyClearAlarmLock(
    scooterId: string,
    locked: boolean,
    lat: number,
    lng: number,
    battery: number,
  ) {
    this.idleOutsideSince.delete(scooterId);
    this.lastPerimeterAlertAt.delete(scooterId);
    this.lastRobberyAlertAt.delete(scooterId);

    const payload = {
      scooterId,
      locked,
      lat,
      lng,
      battery,
      timestamp: new Date().toISOString(),
    };

    this.server
      .to(`scooter_${scooterId}`)
      .to('scooters')
      .to('client_trips')
      .to('dashboard')
      .emit('scooter:alarm_cleared', payload);

    await this.broadcastScooterSnapshot(scooterId);
  }

  /**
   * Envía un aviso operativo preventivo al turista en ruta
   */
  sendOperatorNotice(scooterId: string, message: string, adminName?: string) {
    this.server.to(`scooter_${scooterId}`).to('client_trips').emit('admin:notice', {
      scooterId,
      message,
      adminName: adminName || 'Centro de Control SAME',
      timestamp: new Date().toISOString(),
    });
  }

  notifyZonesUpdated() {
    this.server.to('dashboard').to('client_trips').to('scooters').emit('zones:updated', {
      timestamp: new Date().toISOString(),
    });
  }

  notifyAlertsChanged() {
    this.server.to('dashboard').emit('alerts:updated', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emite el comando de desbloqueo al monopatín (llamado por TripsService al iniciar viaje)
   */
  async sendUnlockCommand(scooterId: string) {
    this.logger.log(`Enviando orden de desbloqueo a monopatín: ${scooterId}`);
    this.clearScooterRuntime(scooterId);
    this.server.to(`scooter_${scooterId}`).emit('scooter:unlock', {
      scooterId,
      timestamp: new Date().toISOString(),
      message: 'Viaje iniciado. Candado desbloqueado.',
    });
    // Respaldo emitiendo también al canal general de scooters
    this.server.to('scooters').emit('scooter:unlock', {
      scooterId,
      timestamp: new Date().toISOString(),
    });

    if (!this.hasExternalSimulator(scooterId)) {
      const rows = await this.dataSource.query(
        `SELECT ST_Y(ubicacion) as lat, ST_X(ubicacion) as lng, nivel_bateria FROM monopatines WHERE id = $1 LIMIT 1;`,
        [scooterId],
      );
      const sc = rows[0];
      if (sc) {
        this.startFallbackRandom(
          scooterId,
          Number(sc.lat) || 11.0182,
          Number(sc.lng) || -74.7952,
          Number(sc.nivel_bateria) || 85,
        );
      }
    }
  }

  /**
   * Emite el comando de bloqueo al monopatín (llamado por TripsService al finalizar viaje)
   */
  sendLockCommand(scooterId: string) {
    this.logger.log(`Enviando orden de bloqueo a monopatín: ${scooterId}`);
    this.clearScooterRuntime(scooterId);
    this.server.to(`scooter_${scooterId}`).emit('scooter:lock', {
      scooterId,
      timestamp: new Date().toISOString(),
      message: 'Viaje finalizado. Candado bloqueado.',
    });
    this.server.to('scooters').emit('scooter:lock', {
      scooterId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emite orden de parada forzada / de emergencia
   */
  sendEmergencyStop(scooterId: string, reason: string) {
    this.clearScooterRuntime(scooterId);
    this.server
      .to(`scooter_${scooterId}`)
      .to('scooters')
      .to('client_trips')
      .emit('scooter:emergency_stop', {
        scooterId,
        reason,
        timestamp: new Date().toISOString(),
      });
  }
}
