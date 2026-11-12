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
var TripsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const viaje_entity_1 = require("../database/entities/viaje.entity");
const monopatin_entity_1 = require("../database/entities/monopatin.entity");
const usuario_entity_1 = require("../database/entities/usuario.entity");
const pago_entity_1 = require("../database/entities/pago.entity");
const alerta_entity_1 = require("../database/entities/alerta.entity");
const telemetry_gateway_1 = require("../telemetry/telemetry.gateway");
let TripsService = TripsService_1 = class TripsService {
    constructor(viajeRepo, monopatinRepo, usuarioRepo, pagoRepo, alertaRepo, dataSource, telemetryGateway) {
        this.viajeRepo = viajeRepo;
        this.monopatinRepo = monopatinRepo;
        this.usuarioRepo = usuarioRepo;
        this.pagoRepo = pagoRepo;
        this.alertaRepo = alertaRepo;
        this.dataSource = dataSource;
        this.telemetryGateway = telemetryGateway;
        this.logger = new common_1.Logger(TripsService_1.name);
        this.DEFAULT_RATE_PER_MINUTE = 500;
    }
    async startTrip(dto) {
        this.logger.log(`Solicitud de inicio de viaje: Usuario=${dto.usuarioId}, Monopatín=${dto.scooterId}`);
        const usuario = await this.usuarioRepo.findOne({ where: { id: dto.usuarioId } });
        if (!usuario) {
            throw new common_1.NotFoundException(`Usuario con ID ${dto.usuarioId} no encontrado.`);
        }
        if (usuario.estado !== 'activo') {
            throw new common_1.BadRequestException('La cuenta del usuario se encuentra bloqueada por saldo pendiente o infracción.');
        }
        if (!usuario.token_pago) {
            throw new common_1.BadRequestException('El usuario no posee un medio de pago registrado o activo.');
        }
        const activeTrip = await this.viajeRepo.findOne({
            where: { usuario_id: usuario.id, estado: 'activo' },
        });
        if (activeTrip) {
            const horasTranscurridas = (Date.now() - new Date(activeTrip.inicio_viaje).getTime()) / (1000 * 60 * 60);
            if (dto.forzarCierreAnterior || horasTranscurridas >= 24) {
                this.logger.warn(`Cierre preventivo de viaje anterior (ID ${activeTrip.id}, antigüedad: ${horasTranscurridas.toFixed(1)} horas). Motivo: ${dto.forzarCierreAnterior ? 'forzarCierreAnterior solicitado' : 'viaje mayor a 24 horas'}`);
                activeTrip.estado = 'cancelado';
                activeTrip.fin_viaje = new Date();
                await this.viajeRepo.save(activeTrip);
                if (activeTrip.monopatin_id !== dto.scooterId) {
                    await this.monopatinRepo.update({ id: activeTrip.monopatin_id }, { estado: 'disponible', velocidad_actual: 0 });
                }
            }
            else {
                throw new common_1.BadRequestException({
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
        const scooter = await this.monopatinRepo.findOne({ where: { id: dto.scooterId } });
        if (!scooter) {
            throw new common_1.NotFoundException(`Monopatín con ID ${dto.scooterId} no registrado en el sistema.`);
        }
        if (scooter.estado !== 'disponible') {
            throw new common_1.BadRequestException(`El monopatín ${dto.scooterId} no está disponible (Estado actual: ${scooter.estado}).`);
        }
        if (scooter.nivel_bateria < 20) {
            throw new common_1.BadRequestException(`Nivel de batería insuficiente (${scooter.nivel_bateria}%). Se requiere mínimo 20% para iniciar un viaje.`);
        }
        const insertViajeRows = await this.dataSource.query(`INSERT INTO viajes (usuario_id, monopatin_id, estado, inicio_viaje) 
       VALUES ($1, $2, 'activo', NOW()) 
       RETURNING id, usuario_id, monopatin_id, inicio_viaje, estado;`, [usuario.id, scooter.id]);
        const viajeGuardado = insertViajeRows[0];
        await this.dataSource.query(`UPDATE monopatines SET estado = 'en uso', updated_at = NOW() WHERE id = $1;`, [scooter.id]);
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
    async endTrip(dto) {
        this.logger.log(`Solicitud de finalización de viaje: Viaje=${dto.viajeId}`);
        const viaje = await this.viajeRepo.findOne({
            where: { id: dto.viajeId },
            relations: ['usuario', 'monopatin'],
        });
        if (!viaje) {
            throw new common_1.NotFoundException(`Viaje con ID ${dto.viajeId} no encontrado.`);
        }
        if (viaje.estado !== 'activo') {
            throw new common_1.BadRequestException(`El viaje ya se encuentra cerrado o cancelado (Estado: ${viaje.estado}).`);
        }
        const scooterId = viaje.monopatin_id;
        const parkingMatch = await this.dataSource.query(`SELECT z.id, z.nombre, z.tarifa_minuto
         FROM monopatines m
         JOIN zonas_geocercas z 
           ON ST_Contains(z.poligono, m.ubicacion)
         WHERE m.id = $1 AND z.tipo = 'parqueo'
         LIMIT 1`, [scooterId]);
        if (parkingMatch.length === 0) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                error: 'Bad Request',
                code: 'OUTSIDE_PARKING_ZONE',
                message: 'No es posible finalizar el viaje: El monopatín no se encuentra dentro de una Estación de Parqueo Autorizado del Gran Malecón. Por favor estacione en una estación designada (ej. Caimán del Río o Pabellón de Cristal).',
            });
        }
        const estacionParqueo = parkingMatch[0];
        this.telemetryGateway.sendLockCommand(scooterId);
        const finViaje = new Date();
        const duracionMs = finViaje.getTime() - new Date(viaje.inicio_viaje).getTime();
        const duracionMinutos = Math.max(1, Math.ceil(duracionMs / (1000 * 60)));
        const tarifaAplicada = Number(estacionParqueo.tarifa_minuto) || this.DEFAULT_RATE_PER_MINUTE;
        const costoTotal = duracionMinutos * tarifaAplicada;
        const refTransaccion = `PAY-SAME-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        const insertPagoRows = await this.dataSource.query(`INSERT INTO pagos (viaje_id, monto, estado, referencia_transaccion, created_at)
       VALUES ($1, $2, 'aprobado', $3, NOW())
       RETURNING id, viaje_id, monto, estado, referencia_transaccion, created_at;`, [viaje.id, costoTotal, refTransaccion]);
        const pagoGuardado = insertPagoRows[0];
        const updateViajeRows = await this.dataSource.query(`UPDATE viajes 
       SET estado = 'finalizado',
           fin_viaje = NOW(),
           duracion_minutos = $1,
           costo_total = $2,
           foto_evidencia_url = $3
       WHERE id = $4
       RETURNING id, usuario_id, monopatin_id, inicio_viaje, fin_viaje, duracion_minutos, costo_total, foto_evidencia_url, estado;`, [duracionMinutos, costoTotal, dto.fotoEvidenciaUrl, dto.viajeId]);
        const viajeActualizado = updateViajeRows[0];
        const updatedScooterRows = await this.dataSource.query(`UPDATE monopatines 
       SET estado = CASE WHEN nivel_bateria < 20 THEN 'mantenimiento' ELSE 'disponible' END,
           velocidad_actual = 0.00,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, estado, nivel_bateria;`, [scooterId]);
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
    async getActiveTripByUserId(usuarioId) {
        return this.viajeRepo.findOne({
            where: { usuario_id: usuarioId, estado: 'activo' },
            relations: ['monopatin'],
        });
    }
    async forceCancelTrip(viajeId) {
        const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
        if (!viaje) {
            throw new common_1.NotFoundException(`Viaje con ID ${viajeId} no encontrado.`);
        }
        viaje.estado = 'cancelado';
        viaje.fin_viaje = new Date();
        await this.viajeRepo.save(viaje);
        await this.monopatinRepo.update({ id: viaje.monopatin_id }, { estado: 'disponible', velocidad_actual: 0 });
        this.telemetryGateway.sendLockCommand(viaje.monopatin_id);
        return {
            statusCode: 200,
            message: `Viaje ${viajeId} cancelado forzosamente. Monopatín ${viaje.monopatin_id} restablecido a disponible.`,
        };
    }
    async resetDevState() {
        await this.dataSource.query('TRUNCATE TABLE pagos, viajes CASCADE;');
        await this.dataSource.query("UPDATE monopatines SET estado = 'disponible', velocidad_actual = 0.00, nivel_bateria = 100;");
        return {
            statusCode: 200,
            message: 'Ambiente reseteado: Viajes truncados y flota restablecida a disponible.',
        };
    }
    async getAllScooters() {
        return this.dataSource.query(`SELECT id, numero_serie, estado, nivel_bateria, velocidad_actual, 
              ST_Y(ubicacion) as lat, ST_X(ubicacion) as lng, updated_at 
       FROM monopatines 
       ORDER BY id ASC;`);
    }
    async getAllTrips() {
        return this.viajeRepo.find({
            order: { inicio_viaje: 'DESC' },
            relations: ['usuario', 'monopatin', 'pagos'],
            take: 50,
        });
    }
};
exports.TripsService = TripsService;
exports.TripsService = TripsService = TripsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(viaje_entity_1.Viaje)),
    __param(1, (0, typeorm_1.InjectRepository)(monopatin_entity_1.Monopatin)),
    __param(2, (0, typeorm_1.InjectRepository)(usuario_entity_1.Usuario)),
    __param(3, (0, typeorm_1.InjectRepository)(pago_entity_1.Pago)),
    __param(4, (0, typeorm_1.InjectRepository)(alerta_entity_1.Alerta)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        telemetry_gateway_1.TelemetryGateway])
], TripsService);
//# sourceMappingURL=trips.service.js.map