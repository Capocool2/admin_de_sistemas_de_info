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

export interface FleetQuickStatus {
  id: string;
  estado: ScooterState;
  battery: number;
  outOfZone?: boolean;
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
  dbId?: string;
  type: 'robo' | 'fuera_perimetro' | 'caida' | 'bateria_baja' | 'abandono';
  scooterId: string;
  lat?: number;
  lng?: number;
  speed?: number;
  status?: 'pendiente' | 'atendida';
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
  estado?: ScooterState;
  zoneName: string;
  zoneType?: ZoneType | 'prohibida' | 'desconocida';
  maxSpeed?: number;
  isInsideParkingZone?: boolean;
  outOfPerimeter?: boolean;
  emergencyStopped?: boolean;
  pendingMaintenance?: boolean;
  timestamp: string;
}

export interface AdminFleetUnit extends TelemetryBroadcast {
  numero_serie?: string;
  estado: ScooterState;
  outOfPerimeter: boolean;
  activeTripId?: string | null;
  activeTripStart?: string | null;
  activeRiderName?: string | null;
  pendingAlertsCount?: number;
  pendingMaintenance?: boolean;
}

export interface AdminTripRecord {
  id: string;
  usuario_id: string;
  monopatin_id: string;
  inicio_viaje: string;
  fin_viaje?: string | null;
  duracion_minutos?: number | null;
  costo_total?: string | number | null;
  foto_evidencia_url?: string | null;
  estado: 'activo' | 'finalizado' | 'cancelado';
  usuario?: {
    id: string;
    nombre_completo: string;
    correo: string;
  };
  pagos?: Array<{
    id: string;
    monto: string | number;
    estado: string;
    referencia_transaccion: string;
  }>;
}

export interface AdminUserRecord {
  id: string;
  nombre_completo: string;
  documento_identidad: string;
  correo: string;
  telefono: string;
  estado: 'activo' | 'bloqueado';
  rol: 'admin' | 'turista';
  created_at: string;
  total_viajes: number;
  viajes_activos: number;
  gasto_total: string | number;
}

export interface AdminZoneRecord {
  id: string;
  nombre: string;
  tipo: ZoneType;
  limite_velocidad: number;
  tarifa_minuto: string | number;
}

export interface AdminSummary {
  total_viajes: number;
  viajes_activos: number;
  viajes_finalizados: number;
  ingresos_totales: string | number;
  multas_aplicadas: number;
  alertas_pendientes: number;
}

