// frontend/src/utils/geofence.ts
import { ZoneGeofence, ZoneType } from '../types';

/**
 * Geocercas oficiales del Gran Malecón del Río (SRID 4326 transformadas a [lat, lng])
 */
export const MALECON_GEOFENCES: ZoneGeofence[] = [
  {
    id: 'z-normal',
    nombre: 'Ciclorruta Avenida del Río (Gran Malecón)',
    tipo: 'normal',
    limite_velocidad: 20,
    tarifa_minuto: 500,
    coordinates: [
      [11.0170, -74.7975],
      [11.0210, -74.7940],
      [11.0140, -74.7890],
      [11.0120, -74.7935],
    ],
  },
  {
    id: 'z-peatonal',
    nombre: 'Paseo Peatonal Caimán del Río (Límite 10 km/h)',
    tipo: 'peatonal',
    limite_velocidad: 10,
    tarifa_minuto: 500,
    coordinates: [
      [11.0170, -74.7945],
      [11.0145, -74.7925],
      [11.0152, -74.7915],
      [11.0177, -74.7935],
    ],
  },
  {
    id: 'z-p1',
    nombre: 'Estación de Parqueo Puerta de Oro (P1)',
    tipo: 'parqueo',
    limite_velocidad: 10,
    tarifa_minuto: 500,
    coordinates: [
      [11.0180, -74.7960],
      [11.0180, -74.7950],
      [11.0195, -74.7950],
      [11.0195, -74.7960],
    ],
  },
  {
    id: 'z-p2',
    nombre: 'Estación de Parqueo Caimán del Río (P2)',
    tipo: 'parqueo',
    limite_velocidad: 10,
    tarifa_minuto: 500,
    coordinates: [
      [11.0145, -74.7930],
      [11.0145, -74.7920],
      [11.0155, -74.7920],
      [11.0155, -74.7930],
    ],
  },
  {
    id: 'z-p3',
    nombre: 'Estación de Parqueo Manglar (P3)',
    tipo: 'parqueo',
    limite_velocidad: 10,
    tarifa_minuto: 500,
    coordinates: [
      [11.0160, -74.7945],
      [11.0160, -74.7935],
      [11.0170, -74.7935],
      [11.0170, -74.7945],
    ],
  },
];

const ZONE_PRIORITY: Record<ZoneType, number> = {
  prohibida: 1,
  peatonal: 2,
  parqueo: 3,
  normal: 4,
};

/**
 * Ray-casting point-in-polygon matching PostGIS ST_Contains for convex/simple polygons.
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface EvaluatedGeofence {
  insidePerimeter: boolean;
  zoneName: string;
  zoneType: ZoneType;
  maxSpeed: number;
  isParkingZone: boolean;
  isPedestrianZone: boolean;
}

/**
 * Evalúa la zona geocerca activa en (lat, lng) respetando la misma prioridad que PostGIS.
 */
export function evaluateGeofence(lat: number, lng: number): EvaluatedGeofence {
  const matched = MALECON_GEOFENCES.filter((geo) =>
    isPointInPolygon(lat, lng, geo.coordinates),
  ).sort((a, b) => ZONE_PRIORITY[a.tipo] - ZONE_PRIORITY[b.tipo]);

  if (matched.length === 0 || matched[0].tipo === 'prohibida') {
    return {
      insidePerimeter: false,
      zoneName: 'Fuera del Gran Malecón',
      zoneType: 'prohibida',
      maxSpeed: 0,
      isParkingZone: false,
      isPedestrianZone: false,
    };
  }

  const top = matched[0];
  const isParkingZone = matched.some((z) => z.tipo === 'parqueo');
  const isPedestrianZone = top.tipo === 'peatonal';
  const maxSpeed = top.tipo === 'peatonal' || top.tipo === 'parqueo' ? 10 : 20;

  return {
    insidePerimeter: true,
    zoneName: top.nombre,
    zoneType: top.tipo,
    maxSpeed,
    isParkingZone,
    isPedestrianZone,
  };
}

/**
 * Sintetizador ligero de alarma acústica IoT (85 dB simulada vía Web Audio API)
 */
export class ScooterAlarmSound {
  private ctx: AudioContext | null = null;
  private intervalId: number | null = null;
  private active = false;

  /**
   * Desbloquea el AudioContext en navegadores tras una interacción del usuario
   */
  unlock() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignorar si Web Audio no está disponible
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    try {
      this.unlock();
      if (!this.ctx) return;

      const playBeep = () => {
        if (!this.ctx || !this.active) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, this.ctx.currentTime);
        osc.frequency.setValueAtTime(680, this.ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.34);
      };

      playBeep();
      this.intervalId = window.setInterval(playBeep, 550);
    } catch {
      // Ignorar si el navegador bloquea AudioContext sin gesto previo
    }
  }

  stop() {
    this.active = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isPlaying(): boolean {
    return this.active;
  }
}
