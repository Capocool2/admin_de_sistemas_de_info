// backend/scooter-simulator.ts
import { io, Socket } from 'socket.io-client';

// Configuración de Conexión
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const SCOOTER_ID = process.env.SCOOTER_ID || 'SCOOTER-01';

// Ruta de waypoints representativos a lo largo del Gran Malecón del Río (Barranquilla)
// Trazado longitudinal sobre la franja pavimentada entre Puerta de Oro y Caimán del Río
const ROUTE_WAYPOINTS = [
  { lat: 11.0182, lng: -74.7952, desc: 'Estación Puerta de Oro (P1 - Parqueo Autorizado)' },
  { lat: 11.0175, lng: -74.7944, desc: 'Avenida del Río (Ciclorruta Principal - 20 km/h)' },
  { lat: 11.0168, lng: -74.7938, desc: 'Ingreso a Paseo Peatonal Caimán del Río (Límite 10 km/h)' },
  { lat: 11.0158, lng: -74.7935, desc: 'Sector Gastronómico y Plaza de Luces' },
  { lat: 11.0150, lng: -74.7925, desc: 'Estación Caimán del Río (P2 - Parqueo Autorizado)' },
  { lat: 11.0165, lng: -74.7940, desc: 'Estación Manglar / Plaza de Luces (P3)' },
  { lat: 11.0170, lng: -74.7940, desc: 'Retorno por ciclorruta hacia Puerta de Oro' },
  { lat: 11.0145, lng: -74.7918, desc: 'Ciclorruta Sur del Malecón' },
];

class ScooterHardwareSimulator {
  private socket: Socket;
  private targetWaypointIndex = 1;
  private lat = ROUTE_WAYPOINTS[0].lat;
  private lng = ROUTE_WAYPOINTS[0].lng;
  private battery = 85.0; // %
  private speed = 0.0; // km/h
  private maxAllowedSpeed = 20.0; // km/h (regulado por geocercas)
  private locked = true; // Candado físico
  private isMoving = false;
  private manualControl = false;
  private telemetryTimer: NodeJS.Timeout | null = null;
  private currentZoneDesc = 'Estación Puerta de Oro (P1)';

  constructor() {
    this.initSocket();
  }

  private pickRandomWaypoint(excludeIndex?: number): number {
    if (ROUTE_WAYPOINTS.length <= 1) return 0;
    let next = Math.floor(Math.random() * ROUTE_WAYPOINTS.length);
    while (next === excludeIndex) {
      next = Math.floor(Math.random() * ROUTE_WAYPOINTS.length);
    }
    return next;
  }

  private initSocket() {
    console.log(`\n======================================================`);
    console.log(`🔌 [HARDWARE IoT] Inicializando módulo de telemetría SAME`);
    console.log(`🚲 Monopatín ID : ${SCOOTER_ID}`);
    console.log(`📡 Servidor     : ${BACKEND_URL}`);
    console.log(`📍 Ubicación    : Lat ${this.lat}, Lng ${this.lng}`);
    console.log(`🔒 Candado      : ${this.locked ? 'BLOQUEADO' : 'DESBLOQUEADO'}`);
    console.log(`🔋 Batería      : ${this.battery}%`);
    console.log(`======================================================\n`);

    this.socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.setupSocketEvents();
    this.startTelemetryLoop();
  }

  private setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log(`✅ [IoT CONECTADO] Enlace WebSocket establecido (Socket ID: ${this.socket.id})`);

      // Suscribirse al canal de scooters y a la sala individual del monopatín
      this.socket.emit('join:room', {
        room: 'scooters',
        scooterId: SCOOTER_ID,
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ [IoT DESCONECTADO] Enlace perdido (${reason}). Reintentando...`);
    });

    // 1. Evento servidor: Desbloquear candado al iniciar viaje
    this.socket.on('scooter:unlock', (data) => {
      if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;

      console.log(`\n🔓 ========================================================`);
      console.log(`[ORDEN DE SERVIDOR] Desbloqueo de Candado Electrónico`);
      console.log(`Mensaje: ${data?.message || 'Viaje iniciado'}`);
      console.log(`Acción: Solenoide activado, tracción habilitada.`);
      console.log(`🔓 ========================================================\n`);

      this.locked = false;
      this.isMoving = true;
      this.manualControl = false;
      this.targetWaypointIndex = this.pickRandomWaypoint(this.targetWaypointIndex);
      this.speed = Math.min(15.0, this.maxAllowedSpeed);
    });

    // 2. Evento servidor: Bloquear candado al finalizar viaje
    this.socket.on('scooter:lock', (data) => {
      if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;

      console.log(`\n🔒 ========================================================`);
      console.log(`[ORDEN DE SERVIDOR] Bloqueo de Candado Electrónico`);
      console.log(`Mensaje: ${data?.message || 'Viaje finalizado'}`);
      console.log(`Acción: Solenoide asegurado, corte de motor, velocidad a 0.`);
      console.log(`🔒 ========================================================\n`);

      this.locked = true;
      this.isMoving = false;
      this.manualControl = false;
      this.speed = 0.0;
    });

    // 3. Evento servidor: Regular límite de velocidad por Geocerca (PostGIS)
    this.socket.on('scooter:set_speed_limit', (data: { scooterId?: string; maxSpeed: number; zoneName: string; reason: string }) => {
      if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;
      this.maxAllowedSpeed = data.maxSpeed;
      this.currentZoneDesc = data.zoneName;

      if (this.speed > this.maxAllowedSpeed) {
        this.speed = this.maxAllowedSpeed;
      }

      if (!this.manualControl) {
        console.log(`⚡ [REGULACIÓN GEOCERCA] Zona: "${data.zoneName}" | Límite Máximo: ${data.maxSpeed} km/h (${data.reason})`);
      }
    });

    // 4. Evento servidor: Parada de Emergencia (Salida de Perímetro o Alerta de Robo)
    this.socket.on('scooter:emergency_stop', (data: { scooterId?: string; reason: string }) => {
      if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;

      this.speed = 0.0;
      this.locked = true;
      this.isMoving = false;
      this.manualControl = false;

      console.log(`\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
      console.log(`🚨 [ALARMA ACÚSTICA IoT & CORTE DE TRACCIÓN ACTIVADOS]`);
      console.log(`🚨 Monopatín: ${SCOOTER_ID}`);
      console.log(`🚨 Motivo: ${data.reason}`);
      console.log(`🚨 Acción Hardware: Relé de corte de batería activado. Candado bloqueado.`);
      console.log(`🚨 Bip continuo de advertencia sonando (85 dB)...`);
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`);
    });

    // 5. Evento servidor: Pausar o reanudar simulación aleatoria desde Control Manual
    this.socket.on(
      'simulator:control_mode',
      (data: { scooterId: string; manual: boolean; lat?: number; lng?: number; battery?: number; locked?: boolean }) => {
        if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;

        if (data.manual) {
          this.manualControl = true;
          console.log(`\n🎮 [CONTROL MANUAL ACTIVADO] Simulación aleatoria pausada para ${SCOOTER_ID}\n`);
        } else {
          this.manualControl = false;
          if (typeof data.lat === 'number') this.lat = data.lat;
          if (typeof data.lng === 'number') this.lng = data.lng;
          if (typeof data.battery === 'number') this.battery = data.battery;
          if (typeof data.locked === 'boolean') {
            this.locked = data.locked;
            this.isMoving = !data.locked;
          }
          this.targetWaypointIndex = this.pickRandomWaypoint(this.targetWaypointIndex);
          console.log(`\n🔀 [CONTROL MANUAL FINALIZADO] Reanudando simulación aleatoria para ${SCOOTER_ID}\n`);
        }
      },
    );

    // 6. Evento servidor: Recolocación logística por operador
    this.socket.on(
      'scooter:relocated',
      (data: { scooterId?: string; lat: number; lng: number; battery?: number; locked?: boolean }) => {
        if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;
        this.lat = data.lat;
        this.lng = data.lng;
        if (typeof data.battery === 'number') this.battery = data.battery;
        this.speed = 0.0;
        this.locked = data.locked !== false;
        this.isMoving = !this.locked;
        this.manualControl = false;
        console.log(`\n🚚 [RECOLOCADO POR ADMIN] ${SCOOTER_ID} movido a [${this.lat.toFixed(4)}, ${this.lng.toFixed(4)}] | Bat: ${this.battery}%\n`);
      },
    );

    // 7. Evento servidor: Liberación de alarma o bloqueo por operador
    this.socket.on(
      'scooter:alarm_cleared',
      (data: { scooterId?: string; locked?: boolean; lat?: number; lng?: number; battery?: number }) => {
        if (data?.scooterId && data.scooterId !== SCOOTER_ID) return;
        if (typeof data.lat === 'number') this.lat = data.lat;
        if (typeof data.lng === 'number') this.lng = data.lng;
        if (typeof data.battery === 'number') this.battery = data.battery;
        this.locked = Boolean(data.locked);
        this.isMoving = !this.locked;
        if (this.locked) {
          this.speed = 0.0;
        }
        console.log(`\n🛡️ [ALARMA LIBERADA POR ADMIN] ${SCOOTER_ID} | Candado: ${this.locked ? 'BLOQUEADO' : 'DESBLOQUEADO'}\n`);
      },
    );

    // 8. Evento servidor: Reseteo de ambiente de pruebas
    this.socket.on('scooter:reset', () => {
      this.lat = ROUTE_WAYPOINTS[0].lat;
      this.lng = ROUTE_WAYPOINTS[0].lng;
      this.battery = 100.0;
      this.speed = 0.0;
      this.maxAllowedSpeed = 20.0;
      this.locked = true;
      this.isMoving = false;
      this.manualControl = false;
      this.currentZoneDesc = ROUTE_WAYPOINTS[0].desc;
      console.log(`\n🔄 [RESETEO DE FLOTA] ${SCOOTER_ID} restablecido en Estación P1 (100% batería, bloqueado)\n`);
    });
  }

  /**
   * Bucle de telemetría IoT periódico: cada 5 segundos reporta coordenadas, batería y velocidad
   * (se detiene automáticamente cuando el usuario toma el control manual)
   */
  private startTelemetryLoop() {
    this.telemetryTimer = setInterval(() => {
      if (this.manualControl) {
        return;
      }

      // Si el monopatín está en marcha (desbloqueado), avanza de forma aleatoria por el Gran Malecón
      if (!this.locked && this.isMoving) {
        const target = ROUTE_WAYPOINTS[this.targetWaypointIndex];
        const dLat = target.lat - this.lat;
        const dLng = target.lng - this.lng;
        const dist = Math.hypot(dLat, dLng);
        const step = 0.0008;

        if (dist <= step) {
          this.lat = target.lat;
          this.lng = target.lng;
          this.targetWaypointIndex = this.pickRandomWaypoint(this.targetWaypointIndex);
        } else {
          this.lat += (dLat / dist) * step;
          this.lng += (dLng / dist) * step;
        }

        // Fluctuación aleatoria realista dentro del límite permitido de la zona
        const minSpeed = Math.min(7, this.maxAllowedSpeed);
        this.speed = Number(
          Math.min(this.maxAllowedSpeed, minSpeed + Math.random() * Math.max(2, this.maxAllowedSpeed - minSpeed)).toFixed(1),
        );

        // Consumo gradual de batería (-0.1% cada ciclo de 5 segundos)
        this.battery = Math.max(0, Number((this.battery - 0.1).toFixed(2)));
      } else {
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

      // Transmisión al WebSocket del backend
      this.socket.emit('telemetry:update', telemetryPayload);

      // Imprimir feed en consola del operador del simulador
      const statusIcon = this.locked ? '🔒' : '🔓';
      console.log(
        `📡 [TELEMETRÍA] ${statusIcon} Estado: ${this.locked ? 'Bloqueado ' : 'En marcha '} | ` +
        `Vel: ${this.speed.toString().padStart(4, ' ')} km/h (Max: ${this.maxAllowedSpeed} km/h) | ` +
        `Bat: ${Math.round(this.battery)}% | ` +
        `Coords: [${this.lat.toFixed(4)}, ${this.lng.toFixed(4)}] (${this.currentZoneDesc})`
      );
    }, 5000);
  }
}

// Ejecución del simulador
new ScooterHardwareSimulator();

