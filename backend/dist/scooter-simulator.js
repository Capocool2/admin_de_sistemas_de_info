"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const SCOOTER_ID = process.env.SCOOTER_ID || 'SCOOTER-01';
const ROUTE_WAYPOINTS = [
    { lat: 11.0182, lng: -74.7952, desc: 'Estación Puerta de Oro (P1 - Parqueo Autorizado)' },
    { lat: 11.0175, lng: -74.7944, desc: 'Avenida del Río (Ciclorruta Principal - 20 km/h)' },
    { lat: 11.0168, lng: -74.7938, desc: 'Ingreso a Paseo Peatonal Caimán del Río (Límite 10 km/h)' },
    { lat: 11.0158, lng: -74.7935, desc: 'Sector Gastronómico y Plaza de Luces' },
    { lat: 11.0150, lng: -74.7925, desc: 'Estación Caimán del Río (P2 - Parqueo Autorizado)' },
    { lat: 11.0158, lng: -74.7933, desc: 'Retorno por la franja peatonal Caimán del Río' },
    { lat: 11.0170, lng: -74.7940, desc: 'Retorno por ciclorruta hacia Puerta de Oro' },
    { lat: 11.0182, lng: -74.7952, desc: 'Llegada de vuelta a Estación Puerta de Oro (P1)' },
];
class ScooterHardwareSimulator {
    constructor() {
        this.currentWaypointIndex = 0;
        this.lat = ROUTE_WAYPOINTS[0].lat;
        this.lng = ROUTE_WAYPOINTS[0].lng;
        this.battery = 85.0;
        this.speed = 0.0;
        this.maxAllowedSpeed = 20.0;
        this.locked = true;
        this.isMoving = false;
        this.telemetryTimer = null;
        this.currentZoneDesc = 'Estación Puerta de Oro (P1)';
        this.initSocket();
    }
    initSocket() {
        console.log(`\n======================================================`);
        console.log(`🔌 [HARDWARE IoT] Inicializando módulo de telemetría SAME`);
        console.log(`🚲 Monopatín ID : ${SCOOTER_ID}`);
        console.log(`📡 Servidor     : ${BACKEND_URL}`);
        console.log(`📍 Ubicación    : Lat ${this.lat}, Lng ${this.lng}`);
        console.log(`🔒 Candado      : ${this.locked ? 'BLOQUEADO' : 'DESBLOQUEADO'}`);
        console.log(`🔋 Batería      : ${this.battery}%`);
        console.log(`======================================================\n`);
        this.socket = (0, socket_io_client_1.io)(BACKEND_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });
        this.setupSocketEvents();
        this.startTelemetryLoop();
    }
    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log(`✅ [IoT CONECTADO] Enlace WebSocket establecido (Socket ID: ${this.socket.id})`);
            this.socket.emit('join:room', {
                room: 'scooters',
                scooterId: SCOOTER_ID,
            });
        });
        this.socket.on('disconnect', (reason) => {
            console.log(`❌ [IoT DESCONECTADO] Enlace perdido (${reason}). Reintentando...`);
        });
        this.socket.on('scooter:unlock', (data) => {
            if (data?.scooterId && data.scooterId !== SCOOTER_ID)
                return;
            console.log(`\n🔓 ========================================================`);
            console.log(`[ORDEN DE SERVIDOR] Desbloqueo de Candado Electrónico`);
            console.log(`Mensaje: ${data?.message || 'Viaje iniciado'}`);
            console.log(`Acción: Solenoide activado, tracción habilitada.`);
            console.log(`🔓 ========================================================\n`);
            this.locked = false;
            this.isMoving = true;
            this.speed = Math.min(15.0, this.maxAllowedSpeed);
        });
        this.socket.on('scooter:lock', (data) => {
            if (data?.scooterId && data.scooterId !== SCOOTER_ID)
                return;
            console.log(`\n🔒 ========================================================`);
            console.log(`[ORDEN DE SERVIDOR] Bloqueo de Candado Electrónico`);
            console.log(`Mensaje: ${data?.message || 'Viaje finalizado'}`);
            console.log(`Acción: Solenoide asegurado, corte de motor, velocidad a 0.`);
            console.log(`🔒 ========================================================\n`);
            this.locked = true;
            this.isMoving = false;
            this.speed = 0.0;
        });
        this.socket.on('scooter:set_speed_limit', (data) => {
            this.maxAllowedSpeed = data.maxSpeed;
            this.currentZoneDesc = data.zoneName;
            if (this.speed > this.maxAllowedSpeed) {
                this.speed = this.maxAllowedSpeed;
            }
            console.log(`⚡ [REGULACIÓN GEOCERCA] Zona: "${data.zoneName}" | Límite Máximo: ${data.maxSpeed} km/h (${data.reason})`);
        });
        this.socket.on('scooter:emergency_stop', (data) => {
            if (data?.scooterId && data.scooterId !== SCOOTER_ID)
                return;
            this.speed = 0.0;
            this.locked = true;
            this.isMoving = false;
            console.log(`\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
            console.log(`🚨 [ALARMA ACÚSTICA IoT & CORTE DE TRACCIÓN ACTIVADOS]`);
            console.log(`🚨 Monopatín: ${SCOOTER_ID}`);
            console.log(`🚨 Motivo: ${data.reason}`);
            console.log(`🚨 Acción Hardware: Relé de corte de batería activado. Candado bloqueado.`);
            console.log(`🚨 Bip continuo de advertencia sonando (85 dB)...`);
            console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`);
        });
    }
    startTelemetryLoop() {
        this.telemetryTimer = setInterval(() => {
            if (!this.locked && this.isMoving) {
                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % ROUTE_WAYPOINTS.length;
                const currentTarget = ROUTE_WAYPOINTS[this.currentWaypointIndex];
                this.lat = currentTarget.lat;
                this.lng = currentTarget.lng;
                this.speed = Math.max(8, Number((this.maxAllowedSpeed - Math.random() * 2).toFixed(1)));
                this.battery = Math.max(0, Number((this.battery - 0.1).toFixed(2)));
            }
            else {
                this.speed = 0.0;
            }
            const telemetryPayload = {
                scooterId: SCOOTER_ID,
                lat: this.lat,
                lng: this.lng,
                speed: this.speed,
                battery: Math.round(this.battery),
                locked: this.locked,
            };
            this.socket.emit('telemetry:update', telemetryPayload, (ack) => {
            });
            const statusIcon = this.locked ? '🔒' : '🔓';
            console.log(`📡 [TELEMETRÍA] ${statusIcon} Estado: ${this.locked ? 'Bloqueado ' : 'En marcha '} | ` +
                `Vel: ${this.speed.toString().padStart(4, ' ')} km/h (Max: ${this.maxAllowedSpeed} km/h) | ` +
                `Bat: ${Math.round(this.battery)}% | ` +
                `Coords: [${this.lat.toFixed(4)}, ${this.lng.toFixed(4)}] (${ROUTE_WAYPOINTS[this.currentWaypointIndex].desc})`);
        }, 5000);
    }
}
new ScooterHardwareSimulator();
//# sourceMappingURL=scooter-simulator.js.map