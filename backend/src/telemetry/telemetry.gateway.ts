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
  private readonly scooterWasOutside = new Map<string, boolean>();
  private readonly lastPerimeterBreachAt = new Map<string, number>();

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
      // a. Zonas internas de velocidad y parqueo (excluyendo el perímetro global)
      const zones: Array<{ id: string; nombre: string; tipo: string; limite_velocidad: number }> =
        await this.dataSource.query(
          `SELECT id, nombre, tipo, limite_velocidad 
           FROM zonas_geocercas 
           WHERE tipo <> 'perimetro' AND ST_Contains(poligono, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           ORDER BY CASE 
             WHEN tipo = 'prohibida' THEN 1
             WHEN tipo = 'peatonal' THEN 2
             WHEN tipo = 'parqueo' THEN 3
             WHEN tipo = 'normal' THEN 4
             ELSE 5 END`,
          [lng, lat],
        );

      // b. Polígono perimetral oficial (Gran Malecón del Río)
      const perimCheck: Array<{ dentro: boolean }> = await this.dataSource.query(
        `SELECT ST_Contains(poligono, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS dentro 
         FROM zonas_geocercas 
         WHERE tipo = 'perimetro' 
         LIMIT 1;`,
        [lng, lat],
      );

      const insidePerimeter = perimCheck.length > 0
        ? Boolean(perimCheck[0]?.dentro)
        : (zones.length > 0 && zones[0].tipo !== 'prohibida');

      const isOutOfPerimeter = !insidePerimeter;
      const isInsideParkingZone = zones.some((z) => z.tipo === 'parqueo');

      // 2. Consulta de viaje activo en Neon
      const activeTrips: Array<{ id: string; usuario_id: string; inicio_viaje: Date }> =
        await this.dataSource.query(
          `SELECT id, usuario_id, inicio_viaje FROM viajes WHERE monopatin_id = $1 AND estado = 'activo' LIMIT 1;`,
          [scooterId],
        );
      const activeTrip = activeTrips.length > 0 ? activeTrips[0] : null;

      // 3. Detección de cruce real (Anti-rebote / Edge Detection con Cooldown)
      let strikesCount = 0;
      let bannedInThisTick = false;
      const estabaFuera = this.scooterWasOutside.get(scooterId) || false;
      const now = Date.now();
      const lastBreach = this.lastPerimeterBreachAt.get(scooterId) || 0;
      const hasCooledDown = now - lastBreach > 4000; // Cooldown mínimo de 4 segundos para evitar ráfagas GPS

      if (activeTrip) {
        if (isOutOfPerimeter && !estabaFuera && hasCooledDown) {
          // Transición DENTRO -> FUERA: Nueva infracción registrada en Neon
          this.scooterWasOutside.set(scooterId, true);
          this.lastPerimeterBreachAt.set(scooterId, now);
          const breach = await this.handlePerimeterBreach(
            scooterId,
            activeTrip,
            lat,
            lng,
            Number(speed) || 0,
          );
          strikesCount = breach.strikes;
          bannedInThisTick = breach.banned;
        } else if (!isOutOfPerimeter && estabaFuera) {
          // Reingreso a DENTRO del perímetro: Regresar flag a false para habilitar la próxima advertencia
          this.scooterWasOutside.set(scooterId, false);
          this.logger.log(`🚲 Monopatín ${scooterId} reingresó al perímetro permitido del Gran Malecón.`);
        }
      } else {
        this.scooterWasOutside.set(scooterId, isOutOfPerimeter);
      }

      // 4. Determinación de zonas y límites de velocidad
      let currentZoneName = 'Fuera del Gran Malecón';
      let currentZoneType: 'normal' | 'peatonal' | 'parqueo' | 'prohibida' = 'prohibida';
      let maxSpeed = 0;

      if (!isOutOfPerimeter) {
        const topZone = zones[0];
        currentZoneName = topZone ? topZone.nombre : 'Gran Malecón';
        currentZoneType = (topZone ? topZone.tipo : 'normal') as 'normal' | 'peatonal' | 'parqueo';
        maxSpeed =
          Number(topZone?.limite_velocidad) ||
          (currentZoneType === 'peatonal' || currentZoneType === 'parqueo' ? 10 : 20);
      } else {
        currentZoneName = 'Fuera del Perímetro del Malecón';
        currentZoneType = 'prohibida';
        // Si tiene viaje activo y no ha sido dado de baja (Strikes 1 o 2), permitir límite reducido de 5 km/h para retorno
        maxSpeed = (activeTrip && !bannedInThisTick) ? 5 : 0;
      }

      // 5. Persistencia estricta en Neon PostgreSQL con PostGIS
      const shouldHardLock = bannedInThisTick || (!activeTrip && isOutOfPerimeter);
      let updatedRows: Array<{ estado: string }> = [];

      if (shouldHardLock) {
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
        const targetSpeed = locked ? 0 : Math.max(0, Math.min(Number(speed) || 0, maxSpeed));
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
          [battery, targetSpeed, lng, lat, scooterId],
        );
      }

      const updatedRow = this.extractFirstRow<{
        estado: 'disponible' | 'en uso' | 'mantenimiento' | 'bloqueado';
      }>(updatedRows);

      const dbEstado = (updatedRow?.estado ||
        (shouldHardLock ? 'bloqueado' : locked ? 'disponible' : 'en uso')) as
        | 'disponible'
        | 'en uso'
        | 'mantenimiento'
        | 'bloqueado';

      const effectiveLocked = Boolean(
        locked ||
          shouldHardLock ||
          dbEstado === 'bloqueado' ||
          dbEstado === 'mantenimiento',
      );
      const effectiveSpeed = effectiveLocked
        ? 0
        : Math.max(0, Math.min(Number(speed) || 0, maxSpeed));

      // 6. Control Antirrobo: Movimiento no autorizado con candado bloqueado
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

      // 7. Control de Batería Crítica (< 15%)
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

      // 8. Regulación de velocidad o avisos para el cliente si no está bloqueado
      if (!effectiveLocked && !bannedInThisTick) {
        const speedReason = isOutOfPerimeter
          ? `Advertencia de perímetro (${strikesCount > 0 ? strikesCount : 1}/3): Velocidad limitada a 5 km/h para retorno.`
          : currentZoneType === 'peatonal'
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

      // 9. Detección automática de abandono por inactividad (>= 30s) fuera de estación de parqueo
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

      // 10. Retransmisión de telemetría a salas de dashboard y clientes móviles
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
        emergencyStopped: isOutOfPerimeter && (shouldHardLock || dbEstado === 'bloqueado'),
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
   * Manejo estricto de salidas del perímetro con acumulación de strikes y baja automática (RN-Strikes)
   */
  private async handlePerimeterBreach(
    scooterId: string,
    trip: { id: string; usuario_id: string; inicio_viaje: Date },
    lat: number,
    lng: number,
    speed: number,
  ): Promise<{ strikes: number; banned: boolean }> {
    this.logger.warn(`🚨 SALIDA DE PERÍMETRO DETECTADA: Monopatín ${scooterId}, Usuario ${trip.usuario_id}`);

    // 1. Incrementar infracciones_perimetro = infracciones_perimetro + 1 en usuarios (RETURNING infracciones_perimetro)
    const updateResult = await this.dataSource.query(
      `UPDATE usuarios 
       SET infracciones_perimetro = infracciones_perimetro + 1 
       WHERE id = $1 
       RETURNING id, nombre_completo, correo, infracciones_perimetro;`,
      [trip.usuario_id],
    );

    const updatedUser = updateResult[0];
    const strikes = Number(updatedUser?.infracciones_perimetro) || 1;

    // 2. Registrar alerta en tabla alertas (tipo_alerta = 'salida_perimetro', coordenadas actuales)
    const alertInsert = await this.dataSource.query(
      `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
       VALUES ($1, 'salida_perimetro', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
       RETURNING id, created_at;`,
      [scooterId, lng, lat],
    );
    const alertId = alertInsert[0]?.id;

    // 3. Emitir alerta en tiempo real al room 'dashboard'
    this.server.to('dashboard').emit('alert:security', {
      alertId,
      type: 'salida_perimetro',
      scooterId,
      userId: trip.usuario_id,
      userName: updatedUser?.nombre_completo,
      userEmail: updatedUser?.correo,
      strikes,
      maxStrikes: 3,
      lat,
      lng,
      speed,
      status: 'pendiente',
      timestamp: new Date().toISOString(),
      message: `¡INFRACCIÓN DE PERÍMETRO! Monopatín ${scooterId} salió del área autorizada. Infracción ${strikes}/3 del usuario ${updatedUser?.nombre_completo || trip.usuario_id}.`,
    });
    this.notifyAlertsChanged();

    // 4. Si infracciones_perimetro es 1 o 2:
    if (strikes < 3) {
      // Emitir scooter:set_speed_limit con límite reducido (5 km/h)
      this.server
        .to(`scooter_${scooterId}`)
        .to('scooters')
        .to('client_trips')
        .emit('scooter:set_speed_limit', {
          scooterId,
          maxSpeed: 5,
          zoneName: 'Fuera de Perímetro Operativo',
          zoneType: 'prohibida',
          reason: `Advertencia ${strikes}/3: Saliste del área autorizada del Malecón. Velocidad limitada a 5 km/h para retorno.`,
        });

      // Emitir evento WebSocket trip:perimeter_warning al cliente con { strike, maxStrikes: 3, message }
      const warningPayload = {
        scooterId,
        userId: trip.usuario_id,
        strike: strikes,
        maxStrikes: 3,
        message: `Advertencia ${strikes}/3: Saliste del área autorizada del Malecón. Al llegar a 3 salidas tu cuenta será dada de baja.`,
      };
      this.server
        .to(`scooter_${scooterId}`)
        .to('client_trips')
        .emit('trip:perimeter_warning', warningPayload);

      this.logger.log(`⚠️ Advertencia de perímetro ${strikes}/3 enviada para monopatín ${scooterId}`);
      return { strikes, banned: false };
    }

    // 5. Si infracciones_perimetro >= 3 (Baja automática definitiva):
    this.logger.error(`🛑 BAJA DEFINITIVA: Usuario ${trip.usuario_id} alcanzó ${strikes} infracciones de perímetro.`);

    // a. Actualizar en Neon: UPDATE usuarios SET estado = 'dado_de_baja' WHERE id = $1;
    await this.dataSource.query(
      `UPDATE usuarios SET estado = 'dado_de_baja' WHERE id = $1;`,
      [trip.usuario_id],
    );

    // b. Finalizar/cancelar el viaje activo en Neon (estado = 'cancelado_infraccion', fin_viaje = NOW())
    const duracionMs = Date.now() - new Date(trip.inicio_viaje).getTime();
    const duracionMinutos = Math.max(1, Math.ceil(duracionMs / (1000 * 60)));
    await this.dataSource.query(
      `UPDATE viajes 
       SET estado = 'cancelado_infraccion', 
           fin_viaje = NOW(),
           duracion_minutos = $1
       WHERE id = $2;`,
      [duracionMinutos, trip.id],
    );

    // c. Actualizar el monopatín en Neon a estado = 'bloqueado'
    await this.dataSource.query(
      `UPDATE monopatines 
       SET estado = 'bloqueado', 
           velocidad_actual = 0.00, 
           updated_at = NOW() 
       WHERE id = $1;`,
      [scooterId],
    );

    // d. Emitir scooter:emergency_stop y scooter:lock hacia el simulador IoT
    this.sendEmergencyStop(
      scooterId,
      'Cuenta dada de baja por acumulación de 3 salidas del área permitida del Malecón. Motor cortado.',
    );
    this.sendLockCommand(scooterId);

    // e. Registrar alerta crítica en alertas (tipo_alerta = 'usuario_dado_de_baja')
    const critAlert = await this.dataSource.query(
      `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
       VALUES ($1, 'usuario_dado_de_baja', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')
       RETURNING id;`,
      [scooterId, lng, lat],
    );

    // f. Emitir advertencia final 3/3 y evento WebSocket user:banned hacia el cliente con motivo exacto
    this.server
      .to(`scooter_${scooterId}`)
      .to('client_trips')
      .emit('trip:perimeter_warning', {
        scooterId,
        userId: trip.usuario_id,
        strike: 3,
        maxStrikes: 3,
        message: 'Advertencia 3/3: Has alcanzado el límite de 3 salidas del área autorizada. Tu cuenta ha sido dada de baja.',
      });

    const banReason = 'Tu cuenta ha sido dada de baja por exceder el límite de 3 salidas del área permitida del Malecón.';
    this.server
      .to(`scooter_${scooterId}`)
      .to('client_trips')
      .emit('user:banned', {
        userId: trip.usuario_id,
        scooterId,
        strikes,
        reason: banReason,
        timestamp: new Date().toISOString(),
      });

    // g. Notificar al dashboard
    this.server.to('dashboard').emit('user:banned_notice', {
      alertId: critAlert[0]?.id,
      userId: trip.usuario_id,
      userName: updatedUser?.nombre_completo,
      userEmail: updatedUser?.correo,
      scooterId,
      strikes,
      reason: banReason,
      timestamp: new Date().toISOString(),
    });

    this.notifyAlertsChanged();
    await this.broadcastScooterSnapshot(scooterId);

    return { strikes, banned: true };
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
    this.scooterWasOutside.delete(scooterId);
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
    this.scooterWasOutside.clear();

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
