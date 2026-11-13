// frontend/src/views/UserMap.tsx

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { QrCode, RefreshCw, LogOut } from 'lucide-react';
import { getSocket, joinRoom } from '../services/socket';
import { startTrip, endTrip, getActiveTrip, resetDevTrips, getScooters } from '../services/api';
import { ScannerModal } from '../components/ScannerModal';
import { ActiveTripPanel } from '../components/ActiveTripPanel';
import { EndTripModal } from '../components/EndTripModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { ActiveTrip, TelemetryBroadcast, TripReceipt, ZoneGeofence, AuthUser } from '../types';

interface UserMapProps {
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

// Usuario de prueba configurado en la base de datos de Neon
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Geocercas oficiales del Gran Malecón del Río (SRID 4326 transformadas a [lat, lng])
// Eje pavimentado de la Avenida del Río entre Puerta de Oro y Caimán del Río
const GEOFENCES: ZoneGeofence[] = [
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

export const UserMap: React.FC<UserMapProps> = ({ currentUser, onLogout }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryBroadcast | null>(null);

  // Modales y estados
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<TripReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeUserId = currentUser?.id || TEST_USER_ID;

  // 1. Cargar viaje activo previo al montar (evita bloqueos si la página se recarga)
  useEffect(() => {
    getActiveTrip(activeUserId)
      .then((trip) => {
        if (trip) {
          setActiveTrip({
            viajeId: trip.id,
            scooterId: trip.monopatin_id,
            inicioViaje: trip.inicio_viaje,
            tarifaMinutoCOP: 500,
            estado: trip.estado,
          });
        }
      })
      .catch((err) => console.log('Sin viaje activo previo:', err));
  }, [activeUserId]);

  // 2. Inicializar mapa Leaflet con OpenStreetMap estándar (Sin marcas de agua ni API Key)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destruir instancia previa si existe (evita error "Map container is already initialized")
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [11.0175, -74.7945],
      zoom: 16,
      zoomControl: false,
    });

    // Capa Abierta de OpenStreetMap estándar
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Dibujar Geocercas en el mapa
    GEOFENCES.forEach((geo) => {
      let color = '#0284c7'; // Normal (azul)
      let fillColor = '#38bdf8';
      let fillOpacity = 0.15;

      if (geo.tipo === 'peatonal') {
        color = '#d97706'; // Amarillo / Ámbar
        fillColor = '#f59e0b';
        fillOpacity = 0.25;
      } else if (geo.tipo === 'parqueo') {
        color = '#059669'; // Verde Esmeralda
        fillColor = '#10b981';
        fillOpacity = 0.4;
      }

      const polygon = L.polygon(geo.coordinates, {
        color,
        weight: 2,
        fillColor,
        fillOpacity,
        dashArray: geo.tipo === 'parqueo' ? '4, 4' : undefined,
      }).addTo(map);

      polygon.bindTooltip(
        `<strong>${geo.nombre}</strong><br/>${
          geo.tipo === 'parqueo'
            ? '✅ Estación Autorizada para Finalizar'
            : geo.tipo === 'peatonal'
            ? '🚶 Zona Peatonal (Máx 10 km/h)'
            : '🚴 Ciclorruta (Máx 20 km/h)'
        }`,
        { sticky: true }
      );
    });

    mapInstanceRef.current = map;

    // Cargar monopatines reales desde PostgreSQL en Neon al iniciar
    getScooters().then((list: any[]) => {
      if (list && list.length > 0 && mapInstanceRef.current) {
        list.forEach((scooter) => {
          const lat = Number(scooter.lat);
          const lng = Number(scooter.lng);
          if (!lat || !lng) return;

          const isLocked = scooter.estado !== 'en uso';
          const markerHtml = `
            <div class="relative flex items-center justify-center w-10 h-10 -ml-2 -mt-2">
              <div class="absolute w-8 h-8 rounded-full ${
                isLocked ? 'bg-emerald-600 shadow-emerald-500/50' : 'bg-cyan-500 shadow-cyan-500/50 animate-pulse'
              } shadow-lg flex items-center justify-center text-white border-2 border-white">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2a3 3 0 0 0-3 3v4h6V5a3 3 0 0 0-3-3zm5 7h-1V5a4 4 0 0 0-8 0v4H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
                </svg>
              </div>
              <div class="absolute -top-1 -right-1 px-1 bg-slate-900 border border-slate-700 text-[9px] font-bold text-white rounded-full">
                ${scooter.nivel_bateria}%
              </div>
            </div>
          `;
          const customIcon = L.divIcon({
            className: 'scooter-marker',
            html: markerHtml,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          if (!markersRef.current[scooter.id]) {
            const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current!);
            marker.bindPopup(`
              <div class="text-xs">
                <p class="font-bold text-sm text-emerald-400">${scooter.id}</p>
                <p>Estado: <strong>${isLocked ? 'Disponible (Bloqueado)' : 'En uso'}</strong></p>
                <p>Batería: <strong>${scooter.nivel_bateria}%</strong></p>
                <p>Velocidad: <strong>${scooter.velocidad_actual} km/h</strong></p>
              </div>
            `);
            markersRef.current[scooter.id] = marker;
          }
        });
      }
    }).catch((err) => console.log('Error cargando flota inicial desde BD:', err));

    // Arreglar cuadros grises y tiles rotos al inicializar o cambiar pestañas
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Conexión con WebSockets para telemetría en tiempo real
  useEffect(() => {
    const socket = getSocket();
    joinRoom('client_trips');

    const handleTelemetry = (data: TelemetryBroadcast) => {
      setLiveTelemetry(data);

      if (!mapInstanceRef.current) return;

      const { scooterId, lat, lng, speed, battery, locked } = data;
      const isLocked = locked;

      const markerHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 -ml-2 -mt-2">
          <div class="absolute w-8 h-8 rounded-full ${
            isLocked ? 'bg-emerald-600 shadow-emerald-500/50' : 'bg-cyan-500 shadow-cyan-500/50 animate-pulse'
          } shadow-lg flex items-center justify-center text-white border-2 border-white">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2a3 3 0 0 0-3 3v4h6V5a3 3 0 0 0-3-3zm5 7h-1V5a4 4 0 0 0-8 0v4H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
            </svg>
          </div>
          <div class="absolute -top-1 -right-1 px-1 bg-slate-900 border border-slate-700 text-[9px] font-bold text-white rounded-full">
            ${battery}%
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'scooter-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (markersRef.current[scooterId]) {
        markersRef.current[scooterId].setLatLng([lat, lng]);
        markersRef.current[scooterId].setIcon(customIcon);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
        marker.bindPopup(`
          <div class="text-xs">
            <p class="font-bold text-sm text-emerald-400">${scooterId}</p>
            <p>Estado: <strong>${isLocked ? 'Disponible (Bloqueado)' : 'En uso'}</strong></p>
            <p>Batería: <strong>${battery}%</strong></p>
            <p>Velocidad: <strong>${speed} km/h</strong></p>
          </div>
        `);
        markersRef.current[scooterId] = marker;
      }
    };

    socket.on('telemetry:broadcast', handleTelemetry);

    return () => {
      socket.off('telemetry:broadcast', handleTelemetry);
    };
  }, []);

  // 4. Iniciar Viaje (con soporte para forzar cierre si existe un viaje anterior colgado)
  const handleUnlockScooter = async (scooterId: string, forzarCierreAnterior = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await startTrip(scooterId, forzarCierreAnterior, activeUserId);
      setActiveTrip(res.data);
      setIsScannerOpen(false);

      if (liveTelemetry && mapInstanceRef.current) {
        mapInstanceRef.current.setView([liveTelemetry.lat, liveTelemetry.lng], 17);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al desbloquear monopatín');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Finalizar Viaje con validación de geocerca PostGIS
  const handleConfirmEndTrip = async (fotoUrl: string) => {
    if (!activeTrip) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await endTrip(activeTrip.viajeId, fotoUrl);
      setReceipt(res.data);
      setActiveTrip(null);
      setIsEndModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'No fue posible finalizar el viaje');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset rápido para pruebas de desarrollo
  const handleDevReset = async () => {
    if (window.confirm('¿Deseas reiniciar los viajes de prueba y liberar todos los monopatines?')) {
      await resetDevTrips();
      setActiveTrip(null);
      setErrorMessage(null);
      alert('Ambiente reiniciado: Monopatines en estado disponible.');
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      {/* Top Floating Header */}
      <header className="absolute top-3 inset-x-3 z-30 flex items-center justify-between p-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl backdrop-blur-md shadow-lg max-w-md mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              Hola, {currentUser?.nombre_completo ? currentUser.nombre_completo.split(' ')[0] : 'Turista'} 👋
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium">Turista Activo • Gran Malecón</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDevReset}
            title="Resetear viajes de prueba"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Cerrar Sesión"
              className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 transition flex items-center gap-1 text-[11px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </header>

      {/* Contenedor del Mapa */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Botón flotante para Escanear / Desbloquear */}
      {!activeTrip && (
        <div className="absolute bottom-6 inset-x-4 z-30 flex justify-center max-w-sm mx-auto">
          <button
            onClick={() => {
              setErrorMessage(null);
              setIsScannerOpen(true);
            }}
            className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/60 transition active:scale-95 border border-emerald-400/30"
          >
            <QrCode className="w-6 h-6 animate-pulse" />
            <span className="text-base tracking-wide">Escanear QR / Desbloquear</span>
          </button>
        </div>
      )}

      {/* Panel de Viaje Activo */}
      {activeTrip && (
        <ActiveTripPanel
          trip={activeTrip}
          telemetry={liveTelemetry}
          onEndTripClick={() => {
            setErrorMessage(null);
            setIsEndModalOpen(true);
          }}
        />
      )}

      {/* Modales */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onUnlock={handleUnlockScooter}
        isLoading={isSubmitting}
        errorMessage={errorMessage}
      />

      <EndTripModal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        onConfirmEnd={handleConfirmEndTrip}
        isLoading={isSubmitting}
        errorMessage={errorMessage}
        scooterId={activeTrip?.scooterId || 'SCOOTER-01'}
      />

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
};
