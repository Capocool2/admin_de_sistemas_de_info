"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TelemetryGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const typeorm_1 = require("typeorm");
const telemetry_update_dto_1 = require("./dto/telemetry-update.dto");
let TelemetryGateway = TelemetryGateway_1 = class TelemetryGateway {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(TelemetryGateway_1.name);
    }
    afterInit() {
        this.logger.log('🛰️ Telemetry WebSocket Gateway inicializado con Socket.io');
    }
    handleConnection(client) {
        this.logger.log(`Cliente conectado: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Cliente desconectado: ${client.id}`);
    }
    handleJoinRoom(client, payload) {
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
    async handleTelemetryUpdate(client, data) {
        try {
            const { scooterId, lat, lng, speed, battery, locked } = data;
            await this.dataSource.query(`UPDATE monopatines SET nivel_bateria = $1, velocidad_actual = $2, ubicacion = ST_SetSRID(ST_MakePoint($3, $4), 4326), updated_at = NOW() WHERE id = $5;`, [battery, speed, lng, lat, scooterId]);
            if (locked && speed > 2.0) {
                this.logger.warn(`🚨 Robo detectado: Monopatín ${scooterId} en movimiento (${speed} km/h) estando bloqueado!`);
                await this.dataSource.query(`INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
           VALUES ($1, 'robo', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')`, [scooterId, lng, lat]);
                this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
                    scooterId,
                    reason: 'Movimiento no autorizado detectado en vehículo bloqueado (Alerta de Hurto)',
                });
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
            const zones = await this.dataSource.query(`SELECT id, nombre, tipo, limite_velocidad 
           FROM zonas_geocercas 
           WHERE ST_Contains(poligono, ST_SetSRID(ST_MakePoint($1, $2), 4326))
           ORDER BY CASE 
             WHEN tipo = 'prohibida' THEN 1
             WHEN tipo = 'peatonal' THEN 2
             WHEN tipo = 'parqueo' THEN 3
             WHEN tipo = 'normal' THEN 4
             ELSE 5 END`, [lng, lat]);
            let currentZoneName = 'Desconocida';
            if (zones.length === 0 || zones[0].tipo === 'prohibida') {
                this.logger.warn(`⚠️ Monopatín ${scooterId} FUERA DEL PERÍMETRO AUTORIZADO (Lat: ${lat}, Lng: ${lng})`);
                await this.dataSource.query(`INSERT INTO alertas (monopatin_id, tipo_alerta, ubicacion, estado)
           VALUES ($1, 'fuera_perimetro', ST_SetSRID(ST_MakePoint($2, $3), 4326), 'pendiente')`, [scooterId, lng, lat]);
                this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
                    scooterId,
                    reason: 'Límite perimetral excedido. Fuera del área segura del Gran Malecón.',
                });
                this.server.to('dashboard').emit('alert:security', {
                    type: 'fuera_perimetro',
                    scooterId,
                    lat,
                    lng,
                    speed,
                    timestamp: new Date().toISOString(),
                    message: `¡INFRACCIÓN DE PERÍMETRO! Monopatín ${scooterId} ha abandonado el Gran Malecón.`,
                });
            }
            else {
                const topZone = zones[0];
                currentZoneName = topZone.nombre;
                if (topZone.tipo === 'peatonal') {
                    this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
                        maxSpeed: 10,
                        zoneName: topZone.nombre,
                        reason: 'Zona Peatonal de alta afluencia (Gran Malecón)',
                    });
                }
                else if (topZone.tipo === 'parqueo') {
                    this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
                        maxSpeed: 10,
                        zoneName: topZone.nombre,
                        reason: 'Estación de Parqueo Autorizado',
                    });
                }
                else {
                    this.server.to(`scooter_${scooterId}`).emit('scooter:set_speed_limit', {
                        maxSpeed: 20,
                        zoneName: topZone.nombre,
                        reason: 'Ciclorruta Gran Malecón',
                    });
                }
            }
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
        }
        catch (error) {
            this.logger.error(`Error procesando telemetría para ${data?.scooterId}:`, error.stack);
            return { status: 'error', message: error.message };
        }
    }
    sendUnlockCommand(scooterId) {
        this.logger.log(`Enviando orden de desbloqueo a monopatín: ${scooterId}`);
        this.server.to(`scooter_${scooterId}`).emit('scooter:unlock', {
            scooterId,
            timestamp: new Date().toISOString(),
            message: 'Viaje iniciado. Candado desbloqueado.',
        });
        this.server.to('scooters').emit('scooter:unlock', {
            scooterId,
            timestamp: new Date().toISOString(),
        });
    }
    sendLockCommand(scooterId) {
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
    sendEmergencyStop(scooterId, reason) {
        this.server.to(`scooter_${scooterId}`).emit('scooter:emergency_stop', {
            scooterId,
            reason,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.TelemetryGateway = TelemetryGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], TelemetryGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], TelemetryGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('telemetry:update'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        telemetry_update_dto_1.TelemetryUpdateDto]),
    __metadata("design:returntype", Promise)
], TelemetryGateway.prototype, "handleTelemetryUpdate", null);
exports.TelemetryGateway = TelemetryGateway = TelemetryGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], TelemetryGateway);
//# sourceMappingURL=telemetry.gateway.js.map