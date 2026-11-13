// frontend/src/views/AdminDashboard.tsx

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ShieldAlert,
  Activity,
  Battery,
  AlertTriangle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { getSocket, joinRoom } from '../services/socket';
import { resetDevTrips, getScooters } from '../services/api';
import { SecurityAlert, TelemetryBroadcast, AuthUser } from '../types';

interface AdminDashboardProps {
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const [fleet, setFleet] = useState<{ [id: string]: TelemetryBroadcast }>({});
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  // Cargar flota real desde PostgreSQL Neon al iniciar
  useEffect(() => {
    getScooters()
      .then((list: any[]) => {
        if (list && list.length > 0) {
          const liveFleet: { [id: string]: TelemetryBroadcast } = {};
          list.forEach((scooter) => {
            liveFleet[scooter.id] = {
              scooterId: scooter.id,
              lat: Number(scooter.lat) || 11.0182,
              lng: Number(scooter.lng) || -74.7952,
              speed: Number(scooter.velocidad_actual) || 0,
              battery: Number(scooter.nivel_bateria) || 100,
              locked: scooter.estado !== 'en uso',
              zoneName: 'Gran Malecón (Neon DB)',
              timestamp: scooter.updated_at || new Date().toISOString(),
            };
          });
          setFleet(liveFleet);
        }
      })
      .catch((err) => console.log('Error cargando flota desde BD:', err));
  }, []);

  // 1. Inicializar mapa Leaflet con OpenStreetMap (Sin API Key, libre de marcas de agua)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destruir instancia previa para evitar error "Map container is already initialized"
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [11.0175, -74.7945],
      zoom: 16,
      zoomControl: true,
    });

    // Capa OpenStreetMap con filtro oscuro elegante (Sin API Key ni restricciones)
    const osmDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      className: 'map-tiles-dark',
    });

    // Capa OpenStreetMap estándar original (Modo Claro)
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });

    // Iniciar con la capa oscura por defecto
    osmDark.addTo(map);

    // Control para alternar capas libremente sin necesidad de credenciales
    L.control
      .layers(
        {
          '🌙 Modo Oscuro (Sin API Key)': osmDark,
          '☀️ Modo Estándar OSM': osmStandard,
        },
        undefined,
        { position: 'topright' }
      )
      .addTo(map);

    // Geocercas Operativas del Gran Malecón
    // A. Perímetro Operativo Autorizado
    const perimeterCoords: [number, number][] = [
      [11.0170, -74.7975],
      [11.0210, -74.7940],
      [11.0140, -74.7890],
      [11.0120, -74.7935],
    ];

    L.polygon(perimeterCoords, {
      color: '#38bdf8',
      weight: 2,
      fillColor: '#0284c7',
      fillOpacity: 0.1,
    })
      .addTo(map)
      .bindTooltip('Perímetro Operativo Autorizado Gran Malecón');

    // B. Paseo Peatonal Caimán del Río (Límite 10 km/h)
    L.polygon(
      [
        [11.0170, -74.7945],
        [11.0145, -74.7925],
        [11.0152, -74.7915],
        [11.0177, -74.7935],
      ],
      {
        color: '#d97706',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.2,
      }
    )
      .addTo(map)
      .bindTooltip('Paseo Peatonal Caimán del Río (Límite: 10 km/h)');

    // C. Estación de Parqueo P1 (Puerta de Oro)
    L.polygon(
      [
        [11.0180, -74.7960],
        [11.0180, -74.7950],
        [11.0195, -74.7950],
        [11.0195, -74.7960],
      ],
      {
        color: '#059669',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.35,
      }
    )
      .addTo(map)
      .bindTooltip('Estación Parqueo P1 - Puerta de Oro');

    // D. Estación de Parqueo P2 (Caimán del Río)
    L.polygon(
      [
        [11.0145, -74.7930],
        [11.0145, -74.7920],
        [11.0155, -74.7920],
        [11.0155, -74.7930],
      ],
      {
        color: '#059669',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.35,
      }
    )
      .addTo(map)
      .bindTooltip('Estación Parqueo P2 - Caimán del Río');

    // E. Estación de Parqueo P3 (Manglar / Pabellón de Cristal)
    L.polygon(
      [
        [11.0160, -74.7945],
        [11.0160, -74.7935],
        [11.0170, -74.7935],
        [11.0170, -74.7945],
      ],
      {
        color: '#059669',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.35,
      }
    )
      .addTo(map)
      .bindTooltip('Estación Parqueo P3 - Manglar');

    mapInstanceRef.current = map;

    // Cargar marcadores iniciales de toda la flota desde PostgreSQL Neon
    getScooters()
      .then((list: any[]) => {
        if (list && list.length > 0 && mapInstanceRef.current) {
          list.forEach((scooter) => {
            const lat = Number(scooter.lat);
            const lng = Number(scooter.lng);
            if (lat && lng && !markersRef.current[scooter.id]) {
              const isLocked = scooter.estado !== 'en uso';
              const markerHtml = `
                <div class="relative flex items-center justify-center w-8 h-8">
                  <div class="w-7 h-7 rounded-full ${
                    !isLocked
                      ? 'bg-cyan-500 shadow-cyan-400/50 animate-pulse'
                      : 'bg-emerald-500 shadow-emerald-400/50'
                  } shadow-md border border-white flex items-center justify-center text-white text-[10px] font-bold">
                    ${scooter.id.replace('SCOOTER-', 'S')}
                  </div>
                </div>
              `;
              const customIcon = L.divIcon({
                className: 'admin-marker',
                html: markerHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
              });
              const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current!);
              marker.bindPopup(`
                <div class="text-xs">
                  <p class="font-bold text-sm text-cyan-400">${scooter.id}</p>
                  <p>Estado: <strong>${scooter.estado}</strong></p>
                  <p>Velocidad: <strong>${scooter.velocidad_actual} km/h</strong></p>
                  <p>Batería: <strong>${scooter.nivel_bateria}%</strong></p>
                </div>
              `);
              markersRef.current[scooter.id] = marker;
            }
          });
        }
      })
      .catch((err) => console.log('Error cargando marcadores iniciales:', err));

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

  // 2. Escuchar eventos en vivo del WebSocket
  useEffect(() => {
    const socket = getSocket();
    joinRoom('dashboard');

    const handleTelemetry = (data: TelemetryBroadcast) => {
      setFleet((prev) => ({
        ...prev,
        [data.scooterId]: data,
      }));

      if (!mapInstanceRef.current) return;

      const { scooterId, lat, lng, speed, battery, locked, emergencyStopped } = data;
      const isLocked = locked;
      const isAlarmed = Boolean(emergencyStopped);

      const markerHtml = `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="w-7 h-7 rounded-full ${
            isAlarmed
              ? 'bg-rose-600 shadow-rose-500/70 animate-ping'
              : !isLocked
              ? 'bg-cyan-500 shadow-cyan-400/50 animate-pulse'
              : 'bg-emerald-500 shadow-emerald-400/50'
          } shadow-md border border-white flex items-center justify-center text-white text-[10px] font-bold">
            ${scooterId.replace('SCOOTER-', 'S')}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'admin-marker',
        html: markerHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const popupHtml = `
        <div class="text-xs">
          <p class="font-bold text-sm text-cyan-400">${scooterId}</p>
          <p>Estado: <strong>${isAlarmed ? 'Bloqueado (Alarma)' : isLocked ? 'Disponible' : 'En uso'}</strong></p>
          <p>Velocidad: <strong>${speed} km/h</strong></p>
          <p>Batería: <strong>${battery}%</strong></p>
        </div>
      `;

      if (markersRef.current[scooterId]) {
        markersRef.current[scooterId].setLatLng([lat, lng]);
        markersRef.current[scooterId].setIcon(customIcon);
        markersRef.current[scooterId].setPopupContent(popupHtml);
      } else {
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
        marker.bindPopup(popupHtml);
        markersRef.current[scooterId] = marker;
      }
    };

    const handleSecurityAlert = (data: any) => {
      const newAlert: SecurityAlert = {
        id: `alert-${Date.now()}`,
        type: data.type || 'robo',
        scooterId: data.scooterId,
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
        message: data.message || 'Alerta de seguridad generada por el servidor',
        timestamp: new Date().toLocaleTimeString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 15)]);
    };

    const handleMaintenanceAlert = (data: any) => {
      const newAlert: SecurityAlert = {
        id: `alert-${Date.now()}`,
        type: 'bateria_baja',
        scooterId: data.scooterId,
        message: data.message || 'Batería en nivel crítico (< 15%)',
        timestamp: new Date().toLocaleTimeString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 15)]);
    };

    const handleResetEvent = () => {
      setAlerts([]);
      getScooters()
        .then((list: any[]) => {
          if (!list || list.length === 0) return;
          const liveFleet: { [id: string]: TelemetryBroadcast } = {};
          list.forEach((scooter) => {
            const lat = Number(scooter.lat) || 11.0182;
            const lng = Number(scooter.lng) || -74.7952;
            const speed = Number(scooter.velocidad_actual) || 0;
            const battery = Number(scooter.nivel_bateria) || 100;
            const locked = scooter.estado !== 'en uso';
            liveFleet[scooter.id] = {
              scooterId: scooter.id,
              lat,
              lng,
              speed,
              battery,
              locked,
              zoneName: 'Gran Malecón (Neon DB)',
              timestamp: scooter.updated_at || new Date().toISOString(),
            };
            markersRef.current[scooter.id]?.setLatLng([lat, lng]);
          });
          setFleet(liveFleet);
        })
        .catch(() => {});
    };

    socket.on('telemetry:broadcast', handleTelemetry);
    socket.on('alert:security', handleSecurityAlert);
    socket.on('alert:maintenance', handleMaintenanceAlert);
    socket.on('scooter:reset', handleResetEvent);

    return () => {
      socket.off('telemetry:broadcast', handleTelemetry);
      socket.off('alert:security', handleSecurityAlert);
      socket.off('alert:maintenance', handleMaintenanceAlert);
      socket.off('scooter:reset', handleResetEvent);
    };
  }, []);

  const handleReset = async () => {
    if (window.confirm('¿Deseas resetear los viajes y restablecer la flota a disponible?')) {
      await resetDevTrips();
      setAlerts([]);
      alert('Ambiente reseteado: Monopatines en estado disponible.');
    }
  };

  const fleetList = Object.values(fleet);
  const totalScooters = fleetList.length;
  const inUseCount = fleetList.filter((s) => !s.locked).length;
  const availableCount = totalScooters - inUseCount;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>SAME • Centro de Control Operativo</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold uppercase">
                Admin RBAC
              </span>
            </h1>
            <p className="text-[10px] text-cyan-400 font-medium">
              {currentUser?.nombre_completo ? `Admin: ${currentUser.nombre_completo}` : 'Torre de Vigilancia y Gestión de Flota'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Resetear Flota</span>
          </button>

          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>WebSocket En Vivo</span>
          </span>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 transition font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Grid: Map on Left (70%) + Alerts Panel on Right (30%) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Map & Metrics */}
        <div className="flex-1 flex flex-col relative h-[60%] lg:h-full">
          {/* Metrics bar */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 grid grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-slate-400 block text-[10px]">Flota Total</span>
              <span className="text-lg font-bold text-white">{totalScooters}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-emerald-400 block text-[10px]">Disponibles</span>
              <span className="text-lg font-bold text-emerald-400">{availableCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-cyan-400 block text-[10px]">En Ruta</span>
              <span className="text-lg font-bold text-cyan-400">{inUseCount}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-rose-400 block text-[10px]">Alertas Activas</span>
              <span className="text-lg font-bold text-rose-400">{alerts.length}</span>
            </div>
          </div>

          {/* Leaflet Map */}
          <div ref={mapContainerRef} className="flex-1 w-full" />
        </div>

        {/* Right Side: Fleet Status & Security Alerts */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/60 flex flex-col h-[40%] lg:h-full overflow-hidden">
          {/* Tab 1: Monitoreo de Flota */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Estado de la Flota</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">{fleetList.length} unidades</span>
          </div>

          <div className="p-3 space-y-2 overflow-y-auto max-h-48 lg:max-h-60">
            {fleetList.map((scooter) => (
              <div
                key={scooter.scooterId}
                className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{scooter.scooterId}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                        scooter.emergencyStopped
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : scooter.locked
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                      }`}
                    >
                      {scooter.emergencyStopped
                        ? 'Bloqueado (Alarma)'
                        : scooter.locked
                        ? 'Disponible'
                        : 'En uso'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[150px] block mt-0.5">
                    {scooter.zoneName}
                  </span>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-slate-200">
                    {scooter.speed} km/h
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-end mt-0.5">
                    <Battery className="w-3 h-3 text-emerald-400" />
                    <span>{scooter.battery}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tab 2: Alertas Críticas de Seguridad */}
          <div className="p-3 border-t border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-bounce" />
              <span>Alertas de Seguridad & Logística</span>
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-full font-bold">
              {alerts.length}
            </span>
          </div>

          <div className="flex-1 p-3 space-y-2 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Sin incidentes críticos reportados
              </div>
            ) : (
              alerts.map((al) => (
                <div
                  key={al.id}
                  className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs animate-fadeIn"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      {al.scooterId} • {al.type.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{al.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">{al.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
