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

  constructor(private readonly dataSource: DataSource) {}

  afterInit() {
    this.logger.log('🛰️ Telemetry WebSocket Gateway inicializado con Socket.io');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
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
      this.logger.log(`Cliente ${client.id} asignado a canal monopatín '${scooterRoom}'`);
    }
    return { status: 'ok', joined: payload?.room };
  }

  /**
   * Recibe telemetría en tiempo real desde el monopatín o simulador.
   * Ejecuta verificaciones de seguridad espacial (PostGIS) y estado.
   */
  @SubscribeMessage('telemetry:update')
  async handleTelemetryUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TelemetryUpdateDto,
  ) {
    try {
      const { scooterId, lat, lng, speed, battery, locked } = data;

      // 1. Persistencia estricta en Neon PostgreSQL con PostGIS
      await this.dataSource.query(
        `UPDATE monopatines SET nivel_bateria = $1, velocidad_actual = $2, ubicacion = ST_SetSRID(ST_MakePoint($3, $4), 4326), updated_at = NOW() WHERE id = $5;`,
        [battery, speed, lng, lat, scooterId],
      );

      // 2. Control Antirrobo: Movimiento no autorizado con candado bloqueado
      if (locked && speed > 2.0) {
        this.logger.warn(`🚨 Robo detectado: Monopatín ${scooterId} en movimiento (${speed} km/h) estando bloqueado!`);

        // Registrar alerta de robo
        await this.dataSource.query(
          `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
           VALUES ($1, 'robo', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')`,
          [scooterId, lng, lat],
        );

        // Forzar corte de tracción y bloqueo acústico al monopatín
        this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
          scooterId,
          reason: 'Movimiento no autorizado detectado en vehículo bloqueado (Alerta de Hurto)',
        });

        // Notificar sala de vigilancia / dashboard
        this.server.to('dashboard').emit('alert:security', {
          type: 'robo',
          scooterId,
          lat,
          lng,
          speed,
          timestamp: new Date().toISOString(),
          message: `¡ALERTA DE ROBO! Monopatín ${scooterId} en movimiento no autorizado.`,
        });
      }

      // 3. Control de Batería Crítica (< 15%)
      if (battery < 15) {
        this.server.to('dashboard').emit('alert:maintenance', {
          type: 'bateria_baja',
          scooterId,
          battery,
          lat,
          lng,
          message: `Monopatín ${scooterId} con batería crítica (${battery}%). Requiere recarga.`,
        });
      }

      // 4. Verificación Espacial con PostGIS (Geofencing)
      // Determina si el punto (lng, lat) está dentro de alguna geocerca del Gran Malecón
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

      let currentZoneName = 'Desconocida';

      if (zones.length === 0 || zones[0].tipo === 'prohibida') {
        // Transgresión de perímetro: fuera del polígono autorizado del Gran Malecón
        this.logger.warn(`⚠️ Monopatín ${scooterId} FUERA DEL PERÍMETRO AUTORIZADO (Lat: ${lat}, Lng: ${lng})`);

        // Registrar alerta de fuga / perímetro
        await this.dataSource.query(
          `INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
           VALUES ($1, 'fuera_perimetro', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')`,
          [scooterId, lng, lat],
        );

        // Enviar parada de emergencia al hardware
        this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
          scooterId,
          reason: 'Límite perimetral excedido. Fuera del área segura del Gran Malecón.',
        });

        // Notificar al equipo de vigilancia
        this.server.to('dashboard').emit('alert:security', {
          type: 'fuera_perimetro',
          scooterId,
          lat,
          lng,
          speed,
          timestamp: new Date().toISOString(),
          message: `¡INFRACCIÓN DE PERÍMETRO! Monopatín ${scooterId} ha abandonado el Gran Malecón.`,
        });
      } else {
        const topZone = zones[0];
        currentZoneName = topZone.nombre;

        if (topZone.tipo === 'peatonal') {
          // Límite automático estricto a 10 km/h en zonas peatonales concurridas
          this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
            maxSpeed: 10,
            zoneName: topZone.nombre,
            reason: 'Zona Peatonal de alta afluencia (Gran Malecón)',
          });
        } else if (topZone.tipo === 'parqueo') {
          this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
            maxSpeed: 10,
            zoneName: topZone.nombre,
            reason: 'Estación de Parqueo Autorizado',
          });
        } else {
          // Zona de circulación normal / ciclorruta (máx 20 km/h)
          this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
            maxSpeed: 20,
            zoneName: topZone.nombre,
            reason: 'Ciclorruta Gran Malecón',
          });
        }
      }

      // 5. Retransmisión de telemetría a salas de dashboard y clientes móviles
      const broadcastPayload = {
        scooterId,
        lat,
        lng,
        speed,
        battery,
        locked,
        zoneName: currentZoneName,
        timestamp: new Date().toISOString(),
      };

      this.server.to('dashboard').to('client_trips').emit('telemetry:broadcast', broadcastPayload);

      return { status: 'acknowledged', zone: currentZoneName };
    } catch (error) {
      this.logger.error(`Error procesando telemetría para ${data?.scooterId}:`, error.stack);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Emite el comando de desbloqueo al monopatín (llamado por TripsService al iniciar viaje)
   */
  sendUnlockCommand(scooterId: string) {
    this.logger.log(`Enviando orden de desbloqueo a monopatín: ${scooterId}`);
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
  }

  /**
   * Emite el comando de bloqueo al monopatín (llamado por TripsService al finalizar viaje)
   */
  sendLockCommand(scooterId: string) {
    this.logger.log(`Enviando orden de bloqueo a monopatín: ${scooterId}`);
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
    this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
      scooterId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}
