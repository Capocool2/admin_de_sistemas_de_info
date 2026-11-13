// frontend/src/views/AdminDashboard.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity,
  Banknote,
  ChevronDown,
  Map as MapIcon,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react';
import { getSocket, joinRoom } from '../services/socket';
import {
  attendAdminAlert,
  clearAdminScooterLock,
  forceCancelTrip,
  getAdminAlerts,
  getAdminFleet,
  getAdminSummary,
  getAdminUsers,
  getAdminZones,
  getAllTrips,
  relocateAdminScooter,
  resetDevTrips,
  sendAdminScooterNotice,
  updateAdminScooterStatus,
  updateAdminUserStatus,
  updateAdminZone,
} from '../services/api';
import {
  AdminFleetUnit,
  AdminSummary,
  AdminTripRecord,
  AdminUserRecord,
  AdminZoneRecord,
  AuthUser,
  ScooterState,
  SecurityAlert,
  TelemetryBroadcast,
} from '../types';
import { evaluateGeofence, MALECON_GEOFENCES } from '../utils/geofence';
import { AdminFleetPanel, FleetFilter } from '../components/admin/AdminFleetPanel';
import { AdminScooterDrawer } from '../components/admin/AdminScooterDrawer';
import { AdminAlertsPanel } from '../components/admin/AdminAlertsPanel';
import { AdminTripsTab } from '../components/admin/AdminTripsTab';
import { AdminUsersZonesTab } from '../components/admin/AdminUsersZonesTab';

interface AdminDashboardProps {
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

type AdminTab = 'map' | 'trips' | 'accounts';

function buildAlertMessage(tipo: string, scooterId: string): string {
  switch (tipo) {
    case 'fuera_perimetro':
      return `${scooterId} salió del perímetro autorizado del Gran Malecón o fue abandonado fuera de estación.`;
    case 'robo':
      return `Movimiento no autorizado detectado con candado bloqueado en ${scooterId}.`;
    case 'bateria_baja':
      return `Batería crítica (<15%) en ${scooterId}. Requiere recogida o recarga.`;
    case 'caida':
      return `Posible caída o impacto reportado en ${scooterId}.`;
    default:
      return `Alerta operativa registrada para ${scooterId}.`;
  }
}

function buildScooterMarkerHtml(unit: AdminFleetUnit): string {
  const shortCode = unit.scooterId.replace('SCOOTER-', 'S');
  const isOut = Boolean(unit.outOfPerimeter);
  const isBlocked = unit.estado === 'bloqueado';
  const isMaint = unit.estado === 'mantenimiento';
  const isInUse = unit.estado === 'en uso';

  const circleColor = isOut || isBlocked
    ? 'bg-rose-600 shadow-rose-500/70'
    : isMaint
    ? 'bg-amber-500 shadow-amber-500/60'
    : isInUse
    ? 'bg-cyan-500 shadow-cyan-400/60'
    : 'bg-emerald-500 shadow-emerald-400/50';

  const pulseRing = isOut
    ? '<span class="absolute w-11 h-11 rounded-full bg-rose-600/45 animate-ping"></span>'
    : isInUse
    ? '<span class="absolute w-10 h-10 rounded-full bg-cyan-400/35 animate-ping"></span>'
    : '';

  const tag = isOut
    ? '<span class="mt-0.5 px-1.5 py-0.2 rounded bg-rose-700 text-white text-[8px] font-extrabold tracking-wide border border-rose-200 shadow-lg whitespace-nowrap">FUERA DE ZONA</span>'
    : isBlocked
    ? '<span class="mt-0.5 px-1 py-0.2 rounded bg-rose-900 text-rose-100 text-[8px] font-bold border border-rose-400 shadow whitespace-nowrap">BLOQUEADO</span>'
    : isMaint
    ? '<span class="mt-0.5 px-1 py-0.2 rounded bg-amber-600 text-white text-[8px] font-bold border border-amber-200 shadow whitespace-nowrap">MANT.</span>'
    : '';

  return `
    <div class="relative flex flex-col items-center justify-center" style="width:96px;margin-left:-34px;margin-top:-14px;">
      <div class="relative flex items-center justify-center w-8 h-8">
        ${pulseRing}
        <div class="relative w-7 h-7 rounded-full ${circleColor} shadow-md border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
          ${shortCode}
        </div>
      </div>
      ${tag}
    </div>
  `;
}

function buildScooterPopupHtml(unit: AdminFleetUnit): string {
  const statusLabel = unit.outOfPerimeter
    ? '<span class="text-rose-400 font-bold">FUERA DE ZONA (Bloqueado)</span>'
    : unit.estado === 'bloqueado'
    ? '<span class="text-rose-400 font-bold">Bloqueado</span>'
    : unit.estado === 'mantenimiento'
    ? '<span class="text-amber-400 font-bold">En Mantenimiento</span>'
    : unit.estado === 'en uso'
    ? '<span class="text-cyan-400 font-bold">En Ruta</span>'
    : '<span class="text-emerald-400 font-bold">Disponible</span>';

  return `
    <div class="text-xs space-y-0.5">
      <p class="font-bold text-sm text-cyan-400">${unit.scooterId}</p>
      <p>Estado: ${statusLabel}</p>
      <p>Zona: <strong>${unit.zoneName}</strong></p>
      ${unit.activeRiderName ? `<p>Turista: <strong>${unit.activeRiderName}</strong></p>` : ''}
      <p>Velocidad: <strong>${unit.speed} km/h</strong></p>
      <p>Batería: <strong>${unit.battery}%</strong></p>
    </div>
  `;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const fleetRef = useRef<{ [id: string]: AdminFleetUnit }>({});
  const followScooterIdRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('map');
  const [fleet, setFleet] = useState<{ [id: string]: AdminFleetUnit }>({});
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [pendingAlertsDbCount, setPendingAlertsDbCount] = useState(0);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('all');
  const [selectedScooterId, setSelectedScooterId] = useState<string | null>(null);
  const [followScooterId, setFollowScooterId] = useState<string | null>(null);

  const [trips, setTrips] = useState<AdminTripRecord[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [zones, setZones] = useState<AdminZoneRecord[]>([]);

  const [isBusy, setIsBusy] = useState(false);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  fleetRef.current = fleet;
  followScooterIdRef.current = followScooterId;

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const syncMarkerOnMap = useCallback((unit: AdminFleetUnit) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const customIcon = L.divIcon({
      className: 'admin-marker-wrapper',
      html: buildScooterMarkerHtml(unit),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const popupHtml = buildScooterPopupHtml(unit);

    if (markersRef.current[unit.scooterId]) {
      markersRef.current[unit.scooterId].setLatLng([unit.lat, unit.lng]);
      markersRef.current[unit.scooterId].setIcon(customIcon);
      markersRef.current[unit.scooterId].setPopupContent(popupHtml);
    } else {
      const marker = L.marker([unit.lat, unit.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setSelectedScooterId(unit.scooterId);
      });
      markersRef.current[unit.scooterId] = marker;
    }
  }, []);

  const loadFleetFromServer = useCallback(async () => {
    try {
      const list = await getAdminFleet();
      if (!Array.isArray(list)) return;

      const nextFleet: { [id: string]: AdminFleetUnit } = {};
      list.forEach((row: any) => {
        const lat = Number(row.lat) || 11.0182;
        const lng = Number(row.lng) || -74.7952;
        const localGeo = evaluateGeofence(lat, lng);
        const outOfPerimeter =
          typeof row.out_of_zone === 'boolean'
            ? row.out_of_zone
            : !localGeo.insidePerimeter;
        const estado = (row.estado || 'disponible') as ScooterState;

        const unit: AdminFleetUnit = {
          scooterId: row.id,
          numero_serie: row.numero_serie,
          lat,
          lng,
          speed: Number(row.velocidad_actual) || 0,
          battery: Number(row.nivel_bateria) ?? 100,
          locked: estado !== 'en uso',
          estado,
          zoneName: outOfPerimeter
            ? 'Fuera del Gran Malecón'
            : row.zone_name || localGeo.zoneName,
          zoneType: outOfPerimeter ? 'prohibida' : row.zone_type || localGeo.zoneType,
          maxSpeed: outOfPerimeter
            ? 0
            : Number(row.limite_velocidad) || localGeo.maxSpeed,
          isInsideParkingZone: Boolean(row.is_parking_zone ?? localGeo.isParkingZone),
          outOfPerimeter,
          emergencyStopped: outOfPerimeter || estado === 'bloqueado',
          activeTripId: row.active_trip_id || null,
          activeTripStart: row.active_trip_start || null,
          activeRiderName: row.active_rider_name || null,
          pendingAlertsCount: Number(row.pending_alerts_count) || 0,
          pendingMaintenance: Boolean(row.pending_maintenance),
          timestamp: row.updated_at || new Date().toISOString(),
        };

        nextFleet[unit.scooterId] = unit;
        syncMarkerOnMap(unit);
      });

      setFleet(nextFleet);
    } catch (err) {
      console.error('Error cargando flota admin:', err);
    }
  }, [syncMarkerOnMap]);

  const loadAlertsFromServer = useCallback(async () => {
    try {
      const res = await getAdminAlerts();
      const rows = res?.alerts || [];
      const mapped: SecurityAlert[] = rows.map((row: any) => ({
        id: row.id,
        dbId: row.id,
        type: row.tipo_alerta || 'fuera_perimetro',
        scooterId: row.monopatin_id,
        lat: row.lat ? Number(row.lat) : undefined,
        lng: row.lng ? Number(row.lng) : undefined,
        status: row.estado || 'pendiente',
        message: buildAlertMessage(row.tipo_alerta, row.monopatin_id),
        timestamp: row.created_at
          ? new Date(row.created_at).toLocaleTimeString()
          : new Date().toLocaleTimeString(),
      }));
      setAlerts(mapped);
      setPendingAlertsDbCount(
        typeof res?.pendingCount === 'number'
          ? res.pendingCount
          : mapped.filter((a) => a.status !== 'atendida').length,
      );
    } catch (err) {
      console.error('Error cargando alertas admin:', err);
    }
  }, []);

  const loadSecondaryData = useCallback(async () => {
    const [tripsList, summaryData, usersList, zonesList] = await Promise.all([
      getAllTrips(),
      getAdminSummary(),
      getAdminUsers(),
      getAdminZones(),
    ]);
    setTrips(tripsList || []);
    setSummary(summaryData);
    setUsers(usersList || []);
    setZones(zonesList || []);
  }, []);

  // Carga inicial completa
  useEffect(() => {
    loadFleetFromServer();
    loadAlertsFromServer();
    loadSecondaryData();
  }, [loadFleetFromServer, loadAlertsFromServer, loadSecondaryData]);

  // Refrescar datos secundarios al cambiar a Viajes o Cuentas
  useEffect(() => {
    if (activeTab === 'map') {
      window.setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
    } else {
      loadSecondaryData();
    }
  }, [activeTab, loadSecondaryData]);

  // 1. Inicializar mapa Leaflet con OpenStreetMap y geocercas oficiales
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [11.0175, -74.7945],
      zoom: 16,
      zoomControl: true,
    });

    const osmDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      className: 'map-tiles-dark',
    });

    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });

    osmDark.addTo(map);
    L.control
      .layers(
        {
          '🌙 Modo Oscuro': osmDark,
          '☀️ Modo Estándar OSM': osmStandard,
        },
        undefined,
        { position: 'topright' },
      )
      .addTo(map);

    MALECON_GEOFENCES.forEach((geo) => {
      let color = '#38bdf8';
      let fillColor = '#0284c7';
      let fillOpacity = 0.1;

      if (geo.tipo === 'peatonal') {
        color = '#d97706';
        fillColor = '#f59e0b';
        fillOpacity = 0.2;
      } else if (geo.tipo === 'parqueo') {
        color = '#059669';
        fillColor = '#10b981';
        fillOpacity = 0.35;
      }

      L.polygon(geo.coordinates, {
        color,
        weight: 2,
        fillColor,
        fillOpacity,
      })
        .addTo(map)
        .bindTooltip(geo.nombre);
    });

    mapInstanceRef.current = map;

    // Renderizar cualquier unidad ya cargada antes de terminar el montaje del mapa
    Object.values(fleetRef.current).forEach((u) => syncMarkerOnMap(u));

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      markersRef.current = {};
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [syncMarkerOnMap]);

  // 2. Escuchar eventos en vivo del WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => {
      joinRoom('dashboard');
    };
    handleConnect();
    socket.on('connect', handleConnect);

    const handleTelemetry = (data: TelemetryBroadcast) => {
      const localGeo = evaluateGeofence(data.lat, data.lng);
      const outOfPerimeter =
        typeof data.outOfPerimeter === 'boolean'
          ? data.outOfPerimeter
          : data.zoneType === 'prohibida' || !localGeo.insidePerimeter;

      const prevUnit = fleetRef.current[data.scooterId];
      const nextEstado: ScooterState =
        data.estado ||
        (outOfPerimeter
          ? 'bloqueado'
          : data.emergencyStopped
          ? 'bloqueado'
          : !data.locked
          ? 'en uso'
          : prevUnit?.estado === 'mantenimiento'
          ? 'mantenimiento'
          : 'disponible');

      const merged: AdminFleetUnit = {
        ...prevUnit,
        ...data,
        estado: nextEstado,
        zoneName: outOfPerimeter
          ? 'Fuera del Gran Malecón'
          : data.zoneName || localGeo.zoneName,
        zoneType: outOfPerimeter ? 'prohibida' : data.zoneType || localGeo.zoneType,
        outOfPerimeter,
        emergencyStopped: outOfPerimeter || nextEstado === 'bloqueado',
        pendingMaintenance:
          typeof data.pendingMaintenance === 'boolean'
            ? data.pendingMaintenance
            : prevUnit?.pendingMaintenance,
        activeTripId:
          nextEstado === 'disponible' || nextEstado === 'mantenimiento'
            ? null
            : prevUnit?.activeTripId,
        activeRiderName:
          nextEstado === 'disponible' || nextEstado === 'mantenimiento'
            ? null
            : prevUnit?.activeRiderName,
      };

      setFleet((prev) => ({
        ...prev,
        [data.scooterId]: merged,
      }));
      syncMarkerOnMap(merged);

      if (followScooterIdRef.current === data.scooterId && mapInstanceRef.current) {
        mapInstanceRef.current.panTo([data.lat, data.lng], {
          animate: true,
          duration: 0.35,
        });
      }

      // Si cambió si está en uso vs disponible, sincronizamos el nombre del turista activo desde BD
      if (prevUnit && prevUnit.estado !== nextEstado) {
        loadFleetFromServer();
      }
    };

    const upsertLiveAlert = (incoming: any, fallbackType: SecurityAlert['type']) => {
      const newAlert: SecurityAlert = {
        id: incoming.alertId || `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dbId: incoming.alertId,
        type: incoming.type || fallbackType,
        scooterId: incoming.scooterId,
        lat: incoming.lat ? Number(incoming.lat) : undefined,
        lng: incoming.lng ? Number(incoming.lng) : undefined,
        speed: incoming.speed,
        status: 'pendiente',
        message:
          incoming.message ||
          buildAlertMessage(incoming.type || fallbackType, incoming.scooterId),
        timestamp: new Date().toLocaleTimeString(),
      };

      setAlerts((prev) => {
        if (newAlert.dbId && prev.some((a) => a.dbId === newAlert.dbId)) {
          return prev;
        }
        return [newAlert, ...prev.slice(0, 60)];
      });
      setPendingAlertsDbCount((prev) => prev + 1);
    };

    const handleSecurityAlert = (data: any) => upsertLiveAlert(data, 'robo');
    const handleMaintenanceAlert = (data: any) => upsertLiveAlert(data, 'bateria_baja');

    const handleResetEvent = () => {
      setSelectedScooterId(null);
      setFollowScooterId(null);
      loadFleetFromServer();
      loadAlertsFromServer();
      loadSecondaryData();
    };

    const handleAlertsUpdated = () => loadAlertsFromServer();
    const handleZonesUpdated = () => loadSecondaryData();

    socket.on('telemetry:broadcast', handleTelemetry);
    socket.on('alert:security', handleSecurityAlert);
    socket.on('alert:maintenance', handleMaintenanceAlert);
    socket.on('scooter:reset', handleResetEvent);
    socket.on('alerts:updated', handleAlertsUpdated);
    socket.on('zones:updated', handleZonesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('telemetry:broadcast', handleTelemetry);
      socket.off('alert:security', handleSecurityAlert);
      socket.off('alert:maintenance', handleMaintenanceAlert);
      socket.off('scooter:reset', handleResetEvent);
      socket.off('alerts:updated', handleAlertsUpdated);
      socket.off('zones:updated', handleZonesUpdated);
    };
  }, [loadAlertsFromServer, loadFleetFromServer, loadSecondaryData, syncMarkerOnMap]);

  // Handlers de acciones administrativas
  const handleSelectScooter = (unit: AdminFleetUnit) => {
    setSelectedScooterId(unit.scooterId);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([unit.lat, unit.lng], 17, { duration: 0.45 });
      markersRef.current[unit.scooterId]?.openPopup();
    }
  };

  const handleToggleFollow = (scooterId: string) => {
    setFollowScooterId((prev) => {
      const next = prev === scooterId ? null : scooterId;
      if (next && fleet[next] && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([fleet[next].lat, fleet[next].lng], 17, { duration: 0.4 });
      }
      return next;
    });
  };

  const handleLocateAlert = (al: SecurityAlert) => {
    const unit = fleet[al.scooterId];
    const targetLat = al.lat ?? unit?.lat;
    const targetLng = al.lng ?? unit?.lng;
    if (targetLat && targetLng && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([targetLat, targetLng], 18, { duration: 0.5 });
    }
    if (unit) {
      setSelectedScooterId(unit.scooterId);
      markersRef.current[unit.scooterId]?.openPopup();
    }
  };

  const handleAttendAlert = async (al: SecurityAlert) => {
    if (!al.dbId) {
      setAlerts((prev) =>
        prev.map((item) => (item.id === al.id ? { ...item, status: 'atendida' } : item)),
      );
      setPendingAlertsDbCount((prev) => Math.max(0, prev - 1));
      return;
    }

    setIsBusy(true);
    try {
      const res = await attendAdminAlert(al.dbId);
      showToast('success', res.message || 'Alerta marcada como atendida');
      await loadAlertsFromServer();
    } catch (err: any) {
      showToast('error', err.message || 'No fue posible atender la alerta');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRelocateScooter = async (scooterId: string, stationId: 'P1' | 'P2' | 'P3') => {
    setIsBusy(true);
    try {
      const res = await relocateAdminScooter(scooterId, stationId, true);
      showToast('success', res.message);
      await Promise.all([loadFleetFromServer(), loadAlertsFromServer()]);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleChangeScooterStatus = async (
    scooterId: string,
    estado: 'disponible' | 'mantenimiento',
    deferIfInUse = false,
  ) => {
    setIsBusy(true);
    try {
      const res = await updateAdminScooterStatus(scooterId, estado, deferIfInUse);
      showToast('success', res.message);
      await loadFleetFromServer();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleClearLock = async (scooterId: string) => {
    setIsBusy(true);
    try {
      const res = await clearAdminScooterLock(scooterId);
      showToast('success', res.message);
      await Promise.all([loadFleetFromServer(), loadAlertsFromServer()]);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendNotice = async (scooterId: string, message: string) => {
    setIsBusy(true);
    try {
      const res = await sendAdminScooterNotice(scooterId, message);
      showToast('success', res.message);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleForceCancelBlockedTrip = async (viajeId: string, scooterId: string) => {
    if (
      !window.confirm(
        `¿Cerrar el viaje bloqueado de ${scooterId} sin aplicar multa manual adicional? Después podrás recolocar la unidad en una estación.`,
      )
    ) {
      return;
    }
    setIsBusy(true);
    try {
      const res = await forceCancelTrip(viajeId);
      showToast('success', res.message || `Viaje en ${scooterId} cerrado`);
      await loadFleetFromServer();
    } catch (err: any) {
      showToast('error', err.message || 'No fue posible cerrar el viaje bloqueado');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleUserStatus = async (user: AdminUserRecord) => {
    const nextStatus = user.estado === 'activo' ? 'bloqueado' : 'activo';
    const actionLabel = nextStatus === 'bloqueado' ? 'suspender' : 'habilitar';
    if (!window.confirm(`¿Deseas ${actionLabel} la cuenta de ${user.nombre_completo}?`)) {
      return;
    }

    setIsBusy(true);
    try {
      const res = await updateAdminUserStatus(user.id, nextStatus);
      showToast('success', res.message);
      await loadSecondaryData();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveZone = async (
    zoneId: string,
    payload: {
      limite_velocidad?: number;
      tarifa_minuto?: number;
      applyRateToAllZones?: boolean;
    },
  ) => {
    setIsBusy(true);
    try {
      const res = await updateAdminZone(zoneId, payload);
      showToast('success', res.message);
      await loadSecondaryData();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    setShowDevMenu(false);
    if (
      window.confirm(
        'HERRAMIENTA DEV: ¿Deseas reiniciar todos los viajes, pagos y alertas para pruebas y devolver la flota a disponible?',
      )
    ) {
      setIsBusy(true);
      try {
        await resetDevTrips();
        setSelectedScooterId(null);
        setFollowScooterId(null);
        await Promise.all([loadFleetFromServer(), loadAlertsFromServer(), loadSecondaryData()]);
        showToast('success', 'Ambiente de pruebas reseteado correctamente.');
      } catch (err: any) {
        showToast('error', err.message || 'Error al resetear flota');
      } finally {
        setIsBusy(false);
      }
    }
  };

  const fleetList = Object.values(fleet);
  const totalScooters = fleetList.length;
  const availableCount = fleetList.filter(
    (s) => s.estado === 'disponible' && !s.outOfPerimeter,
  ).length;
  const inUseCount = fleetList.filter(
    (s) => s.estado === 'en uso' && !s.outOfPerimeter,
  ).length;
  const outOrBlockedCount = fleetList.filter(
    (s) => s.outOfPerimeter || s.estado === 'bloqueado',
  ).length;
  const maintenanceCount = fleetList.filter(
    (s) => s.estado === 'mantenimiento' || s.battery < 20,
  ).length;
  const pendingAlertsCount = Math.max(
    pendingAlertsDbCount,
    alerts.filter((a) => a.status !== 'atendida').length,
  );

  const selectedUnit = selectedScooterId ? fleet[selectedScooterId] || null : null;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Toast flotante de confirmación / error */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 max-w-md px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/70 text-rose-200'
          }`}
        >
          <span>{toast.text}</span>
        </div>
      )}

      {/* Sub-barra Operativa de Torre de Control */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold shrink-0">
            ⚡
          </div>
          <div className="hidden md:block">
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>SAME • Centro de Control</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold uppercase">
                RBAC Operador
              </span>
            </h1>
            <p className="text-[10px] text-cyan-400 font-medium truncate">
              {currentUser?.nombre_completo
                ? `Operador: ${currentUser.nombre_completo}`
                : 'Torre de Vigilancia y Gestión de Flota'}
            </p>
          </div>

          {/* Navegación de Sub-vistas Administrativas */}
          <nav className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 ml-1">
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'map'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Mapa En Vivo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trips')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'trips'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Viajes e Ingresos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'accounts'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cuentas y Zonas</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Telemetría En Vivo</span>
          </span>

          {/* Menú discreto de Herramientas Dev */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDevMenu((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <Wrench className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Pruebas</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showDevMenu && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full px-3 py-2 rounded-lg text-left text-xs text-rose-300 hover:bg-rose-950/70 flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resetear flota y BD (Dev)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Vista 1: Mapa En Vivo + Flota + Acciones + Alertas (siempre montada para no perder estado Leaflet) */}
      <div
        className={
          activeTab === 'map'
            ? 'flex-1 flex flex-col lg:flex-row overflow-hidden'
            : 'hidden'
        }
      >
        {/* Lado Izquierdo: Métricas Exactas + Mapa */}
        <div className="flex-1 flex flex-col relative h-[58%] lg:h-full min-w-0">
          <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-slate-400 block text-[10px]">Flota Total</span>
              <span className="text-lg font-bold font-mono text-white">{totalScooters}</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-emerald-400 block text-[10px]">Disponibles</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {availableCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-cyan-400 block text-[10px]">En Ruta</span>
              <span className="text-lg font-bold font-mono text-cyan-400">{inUseCount}</span>
            </div>
            <div
              className={`p-2 rounded-lg border ${
                outOrBlockedCount > 0
                  ? 'bg-rose-950/50 border-rose-600/70'
                  : 'bg-slate-800/60 border-slate-700/50'
              }`}
            >
              <span className="text-rose-400 block text-[10px]">Fuera Zona / Bloq.</span>
              <span className="text-lg font-bold font-mono text-rose-400">
                {outOrBlockedCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-amber-300 block text-[10px]">Mant. / Bat. &lt;20%</span>
              <span className="text-lg font-bold font-mono text-amber-300">
                {maintenanceCount}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <span className="text-rose-300 block text-[10px]">Alertas Pend.</span>
              <span className="text-lg font-bold font-mono text-rose-300">
                {pendingAlertsCount}
              </span>
            </div>
          </div>

          <div ref={mapContainerRef} className="flex-1 w-full" />
        </div>

        {/* Lado Derecho: Estado de Flota, Acciones sobre Unidad Seleccionada y Alertas */}
        <div className="w-full lg:w-[410px] border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/70 flex flex-col h-[42%] lg:h-full overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Estado de la Flota</span>
            </h3>
            <button
              type="button"
              onClick={loadFleetFromServer}
              title="Sincronizar flota con PostgreSQL"
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{fleetList.length} unidades</span>
            </button>
          </div>

          <AdminFleetPanel
            fleet={fleetList}
            filter={fleetFilter}
            onFilterChange={setFleetFilter}
            selectedScooterId={selectedScooterId}
            followScooterId={followScooterId}
            onSelectScooter={handleSelectScooter}
          />

          {selectedUnit && (
            <AdminScooterDrawer
              unit={selectedUnit}
              isFollowing={followScooterId === selectedUnit.scooterId}
              isBusy={isBusy}
              onClose={() => setSelectedScooterId(null)}
              onToggleFollow={handleToggleFollow}
              onRelocate={handleRelocateScooter}
              onChangeStatus={handleChangeScooterStatus}
              onClearLock={handleClearLock}
              onSendNotice={handleSendNotice}
              onForceCancelBlockedTrip={handleForceCancelBlockedTrip}
            />
          )}

          <AdminAlertsPanel
            alerts={alerts}
            pendingCount={pendingAlertsCount}
            onLocateAlert={handleLocateAlert}
            onAttendAlert={handleAttendAlert}
          />
        </div>
      </div>

      {/* Vista 2: Viajes e Ingresos */}
      {activeTab === 'trips' && (
        <AdminTripsTab
          trips={trips}
          summary={summary}
          onRefresh={loadSecondaryData}
        />
      )}

      {/* Vista 3: Cuentas de Turistas y Reglas PostGIS */}
      {activeTab === 'accounts' && (
        <AdminUsersZonesTab
          users={users}
          zones={zones}
          isBusy={isBusy}
          onToggleUserStatus={handleToggleUserStatus}
          onSaveZone={handleSaveZone}
        />
      )}
    </div>
  );
};
