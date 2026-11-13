// frontend/src/services/api.ts
import { AuthResponse } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export function getAuthToken(): string | null {
  return localStorage.getItem('same_auth_token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('same_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getHeaders(extraHeaders: Record<string, string> = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// 1. AUTENTICACIÓN & CONTROL DE ACCESO
// ---------------------------------------------------------------------------

export async function login(correo: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Credenciales inválidas');
  }

  // Guardar sesión en localStorage
  if (data.access_token && data.user) {
    localStorage.setItem('same_auth_token', data.access_token);
    localStorage.setItem('same_user', JSON.stringify(data.user));
  }

  return data;
}

export async function registerTourist(data: {
  nombre_completo: string;
  documento_identidad: string;
  correo: string;
  telefono: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Error al registrar la cuenta');
  }

  // Guardar sesión en localStorage
  if (resData.access_token && resData.user) {
    localStorage.setItem('same_auth_token', resData.access_token);
    localStorage.setItem('same_user', JSON.stringify(resData.user));
  }

  return resData;
}

export function logout() {
  localStorage.removeItem('same_auth_token');
  localStorage.removeItem('same_user');
}

// ---------------------------------------------------------------------------
// 2. GESTIÓN DE VIAJES Y FLOTA
// ---------------------------------------------------------------------------

export async function startTrip(
  scooterId: string,
  forzarCierreAnterior = false,
  usuarioIdOverride?: string,
) {
  const currentUser = getStoredUser();
  const usuarioId = usuarioIdOverride || currentUser?.id;

  const response = await fetch(`${API_BASE_URL}/api/trips/start`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      usuarioId,
      scooterId,
      forzarCierreAnterior,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Error al iniciar el viaje');
    error.code = data.code;
    error.data = data.data;
    throw error;
  }
  return data;
}

export async function endTrip(
  viajeId: string,
  fotoEvidenciaUrl: string,
  forzarAbandono = false,
) {
  const response = await fetch(`${API_BASE_URL}/api/trips/end`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ viajeId, fotoEvidenciaUrl, forzarAbandono }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Error al finalizar el viaje');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function getActiveTrip(usuarioId?: string) {
  const targetId = usuarioId || getStoredUser()?.id || 'me';
  const response = await fetch(`${API_BASE_URL}/api/trips/active/${targetId}`, {
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

export async function forceCancelTrip(viajeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/force-cancel/${viajeId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return response.json();
}

export async function resetDevTrips() {
  const response = await fetch(`${API_BASE_URL}/api/trips/reset-dev`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return response.json();
}

export async function getScooters() {
  const response = await fetch(`${API_BASE_URL}/api/trips/scooters`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function getPublicZones() {
  const response = await fetch(`${API_BASE_URL}/api/trips/zones`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function getAllTrips() {
  const response = await fetch(`${API_BASE_URL}/api/trips`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

// ---------------------------------------------------------------------------
// 3. TORRE DE CONTROL ADMINISTRATIVA (RBAC: admin)
// ---------------------------------------------------------------------------

async function parseJsonOrThrow(response: Response, fallbackMsg: string) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMsg);
  }
  return data;
}

export async function getAdminFleet() {
  const response = await fetch(`${API_BASE_URL}/api/admin/fleet`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function getAdminSummary() {
  const response = await fetch(`${API_BASE_URL}/api/admin/summary`, {
    headers: getHeaders(),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.data || null;
}

export async function updateAdminScooterStatus(
  scooterId: string,
  estado: 'disponible' | 'mantenimiento',
  deferIfInUse = false,
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/scooters/${scooterId}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ estado, deferIfInUse }),
  });
  return parseJsonOrThrow(response, 'No fue posible actualizar el estado del monopatín');
}

export async function relocateAdminScooter(
  scooterId: string,
  stationId: 'P1' | 'P2' | 'P3',
  rechargeBattery = true,
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/scooters/${scooterId}/relocate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ stationId, rechargeBattery }),
  });
  return parseJsonOrThrow(response, 'No fue posible recolocar el monopatín');
}

export async function clearAdminScooterLock(scooterId: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/scooters/${scooterId}/clear-lock`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return parseJsonOrThrow(response, 'No fue posible liberar el bloqueo');
}

export async function sendAdminScooterNotice(scooterId: string, message: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/scooters/${scooterId}/notice`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message }),
  });
  return parseJsonOrThrow(response, 'No fue posible enviar el aviso al turista');
}

export async function getAdminAlerts(estado?: 'pendiente' | 'atendida') {
  const query = estado ? `?estado=${estado}` : '';
  const response = await fetch(`${API_BASE_URL}/api/admin/alerts${query}`, {
    headers: getHeaders(),
  });
  if (!response.ok) return { alerts: [], pendingCount: 0 };
  const data = await response.json();
  return data.data || { alerts: [], pendingCount: 0 };
}

export async function attendAdminAlert(alertId: string) {
  const response = await fetch(`${API_BASE_URL}/api/admin/alerts/${alertId}/attend`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  return parseJsonOrThrow(response, 'No fue posible marcar la alerta como atendida');
}

export async function getAdminUsers() {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function updateAdminUserStatus(
  userId: string,
  estado: 'activo' | 'bloqueado',
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ estado }),
  });
  return parseJsonOrThrow(response, 'No fue posible actualizar la cuenta del usuario');
}

export async function getAdminZones() {
  const response = await fetch(`${API_BASE_URL}/api/admin/zones`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function updateAdminZone(
  zoneId: string,
  payload: {
    limite_velocidad?: number;
    tarifa_minuto?: number;
    applyRateToAllZones?: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/api/admin/zones/${zoneId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response, 'No fue posible actualizar la configuración de zona');
}
