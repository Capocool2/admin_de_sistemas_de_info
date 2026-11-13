// frontend/src/types/index.ts

export type ScooterState = 'disponible' | 'en uso' | 'mantenimiento' | 'bloqueado';

export interface Scooter {
  id: string; // ej: 'SCOOTER-01'
  numero_serie: string;
  estado: ScooterState;
  nivel_bateria: number;
  velocidad_actual: number;
  lat: number;
  lng: number;
  updated_at?: string;
}

export type ZoneType = 'normal' | 'peatonal' | 'parqueo' | 'prohibida';

export interface ZoneGeofence {
  id: string;
  nombre: string;
  tipo: ZoneType;
  limite_velocidad: number;
  tarifa_minuto: number;
  coordinates: [number, number][]; // [lat, lng] para Leaflet
}

export interface ActiveTrip {
  viajeId: string;
  scooterId: string;
  inicioViaje: string;
  tarifaMinutoCOP: number;
  estado: 'activo' | 'finalizado' | 'cancelado';
}

export interface TripReceipt {
  viajeId: string;
  scooterId: string;
  estacionParqueo: string;
  inicioViaje: string;
  finViaje: string;
  duracionMinutos: number;
  tarifaMinutoCOP: number;
  multaCOP?: number;
  penalizado?: boolean;
  costoTotalCOP: number;
  pago: {
    id: string;
    referencia: string;
    estado: string;
    monto: number;
  };
  scooterEstadoActual: ScooterState;
}

export interface AuthUser {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: 'admin' | 'turista';
}

export interface AuthResponse {
  statusCode: number;
  message: string;
  access_token: string;
  user: AuthUser;
}

export interface SecurityAlert {
  id: string;
  type: 'robo' | 'fuera_perimetro' | 'caida' | 'bateria_baja' | 'abandono';
  scooterId: string;
  lat?: number;
  lng?: number;
  speed?: number;
  message: string;
  timestamp: string;
}

export interface TelemetryBroadcast {
  scooterId: string;
  lat: number;
  lng: number;
  speed: number;
  battery: number;
  locked: boolean;
  zoneName: string;
  zoneType?: ZoneType | 'prohibida' | 'desconocida';
  maxSpeed?: number;
  isInsideParkingZone?: boolean;
  emergencyStopped?: boolean;
  timestamp: string;
}

