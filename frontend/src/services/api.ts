// frontend/src/services/api.ts

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

export async function startTrip(
  usuarioId: string,
  scooterId: string,
  forzarCierreAnterior?: boolean,
) {
  const response = await fetch(`${API_BASE_URL}/api/trips/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId, scooterId, forzarCierreAnterior }),
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

export async function endTrip(viajeId: string, fotoEvidenciaUrl: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viajeId, fotoEvidenciaUrl }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error: any = new Error(data.message || 'Error al finalizar el viaje');
    error.code = data.code;
    throw error;
  }
  return data;
}

export async function getActiveTrip(usuarioId: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/active/${usuarioId}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.data;
}

export async function forceCancelTrip(viajeId: string) {
  const response = await fetch(`${API_BASE_URL}/api/trips/force-cancel/${viajeId}`, {
    method: 'POST',
  });
  return response.json();
}

export async function resetDevTrips() {
  const response = await fetch(`${API_BASE_URL}/api/trips/reset-dev`, {
    method: 'POST',
  });
  return response.json();
}

export async function getScooters() {
  const response = await fetch(`${API_BASE_URL}/api/trips/scooters`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}

export async function getAllTrips() {
  const response = await fetch(`${API_BASE_URL}/api/trips`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.data || [];
}
