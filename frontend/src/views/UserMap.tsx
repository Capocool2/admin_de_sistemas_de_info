// frontend/src/views/UserMap.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { QrCode, RefreshCw, LogOut } from 'lucide-react';
import { getSocket, joinRoom } from '../services/socket';
import { startTrip, endTrip, getActiveTrip, resetDevTrips, getScooters } from '../services/api';
import { ScannerModal } from '../components/ScannerModal';
import { ActiveTripPanel } from '../components/ActiveTripPanel';
import { EndTripModal } from '../components/EndTripModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { JoystickControl, JoystickVector } from '../components/JoystickControl';
import { ActiveTrip, TelemetryBroadcast, TripReceipt, AuthUser } from '../types';
import {
  MALECON_GEOFENCES,
  evaluateGeofence,
  ScooterAlarmSound,
} from '../utils/geofence';

interface UserMapProps {
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

interface LocalScooterState {
  lat: number;
  lng: number;
  battery: number;
  speed: number;
  locked: boolean;
}

// Usuario de prueba configurado en la base de datos de Neon
const TEST_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// Escala de desplazamiento visual en mapa (~0.00018 deg/s a 20 km/h)
const DEG_PER_KMH_PER_SEC = 0.000009;
const BATTERY_DROP_PER_DEG = 280; // ~0.1% cada 0.00036 grados recorridos

export const UserMap: React.FC<UserMapProps> = ({ currentUser, onLogout }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const scooterStatesRef = useRef<{ [key: string]: LocalScooterState }>({});

  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryBroadcast | null>(null);

  // Control manual simulado (WASD / Flechas / Joystick) y seguridad
  const [isManualControl, setIsManualControl] = useState(false);
  const [showJoystick, setShowJoystick] = useState(false);
  const [isTripPanelMinimized, setIsTripPanelMinimized] = useState(false);
  const [isEmergencyLocked, setIsEmergencyLocked] = useState(false);
  const [alarmReason, setAlarmReason] = useState<string | null>(null);
  const [isAlarmAudioActive, setIsAlarmAudioActive] = useState(false);
  const [idleSecondsOutsideParking, setIdleSecondsOutsideParking] = useState(0);
  const [systemBanner, setSystemBanner] = useState<string | null>(null);

  // Modales y estados
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<TripReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs para bucle de físicas y listeners sin cierres obsoletos
  const activeTripRef = useRef<ActiveTrip | null>(null);
  const isManualControlRef = useRef(false);
  const isEmergencyLockedRef = useRef(false);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const joystickVectorRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const alarmSoundRef = useRef<ScooterAlarmSound>(new ScooterAlarmSound());
  const batteryFracRef = useRef(0);
  const lastEmitAtRef = useRef(0);
  const lastUiSyncAtRef = useRef(0);
  const lastZoneTypeRef = useRef<string | null>(null);
  const idleOutsideSinceRef = useRef<number | null>(null);

  activeTripRef.current = activeTrip;
  isManualControlRef.current = isManualControl;
  isEmergencyLockedRef.current = isEmergencyLocked;

  useEffect(() => {
    if (!activeTrip) {
      setIsTripPanelMinimized(false);
    }
  }, [activeTrip]);

  const activeUserId = currentUser?.id || TEST_USER_ID;

  const updateScooterMarker = useCallback(
    (
      scooterId: string,
      lat: number,
      lng: number,
      speed: number,
      battery: number,
      locked: boolean,
      alarmed = false,
    ) => {
      if (!mapInstanceRef.current) return;

      const bubbleClass = alarmed
        ? 'bg-rose-600 shadow-rose-500/70 animate-ping'
        : locked
        ? 'bg-emerald-600 shadow-emerald-500/50'
        : 'bg-cyan-500 shadow-cyan-500/50 animate-pulse';

      const iconColorClass = alarmed
        ? 'bg-rose-600 shadow-rose-500/70'
        : locked
        ? 'bg-emerald-600 shadow-emerald-500/50'
        : 'bg-cyan-500 shadow-cyan-500/50 animate-pulse';

      const markerHtml = `
        <div class="relative flex items-center justify-center w-10 h-10 -ml-2 -mt-2">
          ${alarmed ? `<div class="absolute w-10 h-10 rounded-full ${bubbleClass} opacity-75"></div>` : ''}
          <div class="relative w-8 h-8 rounded-full ${iconColorClass} shadow-lg flex items-center justify-center text-white border-2 border-white">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2a3 3 0 0 0-3 3v4h6V5a3 3 0 0 0-3-3zm5 7h-1V5a4 4 0 0 0-8 0v4H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
            </svg>
          </div>
          <div class="absolute -top-1 -right-1 px-1 bg-slate-900 border border-slate-700 text-[9px] font-bold text-white rounded-full">
            ${Math.round(battery)}%
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'scooter-marker',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const popupHtml = `
        <div class="text-xs">
          <p class="font-bold text-sm text-emerald-400">${scooterId}</p>
          <p>Estado: <strong>${alarmed ? 'Bloqueado (Alarma)' : locked ? 'Disponible (Bloqueado)' : 'En uso'}</strong></p>
          <p>Batería: <strong>${Math.round(battery)}%</strong></p>
          <p>Velocidad: <strong>${speed} km/h</strong></p>
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
    },
    [],
  );

  const loadInitialFleet = useCallback(async () => {
    try {
      const list: any[] = await getScooters();
      if (!list || list.length === 0) return;

      list.forEach((scooter) => {
        const lat = Number(scooter.lat);
        const lng = Number(scooter.lng);
        if (!lat || !lng) return;

        const battery = Number(scooter.nivel_bateria) || 100;
        const speed = Number(scooter.velocidad_actual) || 0;
        const locked = scooter.estado !== 'en uso';
        const alarmed = scooter.estado === 'bloqueado';

        scooterStatesRef.current[scooter.id] = { lat, lng, battery, speed, locked };
        updateScooterMarker(scooter.id, lat, lng, speed, battery, locked, alarmed);
      });
    } catch (err) {
      console.log('Error cargando flota inicial desde BD:', err);
    }
  }, [updateScooterMarker]);

  const stopAlarm = useCallback(() => {
    alarmSoundRef.current.stop();
    setIsAlarmAudioActive(false);
  }, []);

  const stopManualModeAndNotify = useCallback(
    (resumeRandom = true) => {
      const trip = activeTripRef.current;
      keysPressedRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      setIsManualControl(false);
      setShowJoystick(false);
      idleOutsideSinceRef.current = null;
      setIdleSecondsOutsideParking(0);

      if (mapInstanceRef.current?.keyboard) {
        mapInstanceRef.current.keyboard.enable();
      }

      if (trip && resumeRandom) {
        const st = scooterStatesRef.current[trip.scooterId];
        const socket = getSocket();
        socket.emit('simulator:control_mode', {
          scooterId: trip.scooterId,
          manual: false,
          lat: st?.lat,
          lng: st?.lng,
          battery: st ? Math.round(st.battery) : undefined,
          speed: 0,
          locked: isEmergencyLockedRef.current,
        });
      }
    },
    [],
  );

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
          joinRoom('client_trips', trip.monopatin_id);
        }
      })
      .catch((err) => console.log('Sin viaje activo previo:', err));
  }, [activeUserId]);

  // 2. Inicializar mapa Leaflet con OpenStreetMap estándar (Sin marcas de agua ni API Key)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [11.0175, -74.7945],
      zoom: 16,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Dibujar Geocercas en el mapa
    MALECON_GEOFENCES.forEach((geo) => {
      let color = '#0284c7'; // Normal (azul)
      let fillColor = '#38bdf8';
      let fillOpacity = 0.15;

      if (geo.tipo === 'peatonal') {
        color = '#d97706'; // Ámbar
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
            ? '✅ Estación Autorizada para Finalizar (Máx 10 km/h)'
            : geo.tipo === 'peatonal'
            ? '🚶 Zona Peatonal (Máx 10 km/h)'
            : '🚴 Ciclorruta (Máx 20 km/h)'
        }`,
        { sticky: true },
      );
    });

    mapInstanceRef.current = map;
    loadInitialFleet();

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
      alarmSoundRef.current.stop();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loadInitialFleet]);

  // Al salir/desmontar la vista, liberar control manual si estaba activo
  useEffect(() => {
    return () => {
      if (isManualControlRef.current && activeTripRef.current) {
        const st = scooterStatesRef.current[activeTripRef.current.scooterId];
        getSocket().emit('simulator:control_mode', {
          scooterId: activeTripRef.current.scooterId,
          manual: false,
          lat: st?.lat,
          lng: st?.lng,
          battery: st ? Math.round(st.battery) : undefined,
          speed: 0,
          locked: isEmergencyLockedRef.current,
        });
      }
    };
  }, []);

  // 3. Conexión con WebSockets para telemetría y alertas en tiempo real
  useEffect(() => {
    const socket = getSocket();
    joinRoom('client_trips', activeTrip?.scooterId);

    const handleTelemetry = (data: TelemetryBroadcast) => {
      const currentTrip = activeTripRef.current;
      const isControllingThisScooter =
        isManualControlRef.current && currentTrip?.scooterId === data.scooterId;

      if (isControllingThisScooter) {
        // Durante conducción manual, mantenemos la posición local suave sin saltos atrás,
        // pero acatamos bloqueos de emergencia o paradas desde el servidor.
        if (data.emergencyStopped || data.locked) {
          setIsEmergencyLocked(true);
          setIsManualControl(false);
          setShowJoystick(false);
          setLiveTelemetry(data);
          updateScooterMarker(
            data.scooterId,
            data.lat,
            data.lng,
            0,
            data.battery,
            true,
            true,
          );
        }
        return;
      }

      scooterStatesRef.current[data.scooterId] = {
        lat: data.lat,
        lng: data.lng,
        battery: data.battery,
        speed: data.speed,
        locked: data.locked,
      };

      if (!currentTrip || currentTrip.scooterId === data.scooterId) {
        setLiveTelemetry(data);
      }

      if (data.emergencyStopped && currentTrip?.scooterId === data.scooterId) {
        setIsEmergencyLocked(true);
        setAlarmReason(
          'Fuera del perímetro del Gran Malecón. Motor apagado y candado cerrado.',
        );
      }

      updateScooterMarker(
        data.scooterId,
        data.lat,
        data.lng,
        data.speed,
        data.battery,
        data.locked,
        Boolean(data.emergencyStopped),
      );
    };

    const handleEmergencyStop = (data: { scooterId?: string; reason?: string }) => {
      const currentTrip = activeTripRef.current;
      if (!currentTrip || (data?.scooterId && data.scooterId !== currentTrip.scooterId)) {
        return;
      }

      keysPressedRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      setIsManualControl(false);
      setShowJoystick(false);
      setIsEmergencyLocked(true);
      setAlarmReason(
        data.reason ||
          'Límite del Gran Malecón excedido: motor apagado, candado cerrado y alarma activada.',
      );
      alarmSoundRef.current.start();
      setIsAlarmAudioActive(true);

      if (mapInstanceRef.current?.keyboard) {
        mapInstanceRef.current.keyboard.enable();
      }

      const st = scooterStatesRef.current[currentTrip.scooterId];
      if (st) {
        st.speed = 0;
        st.locked = true;
        updateScooterMarker(
          currentTrip.scooterId,
          st.lat,
          st.lng,
          0,
          st.battery,
          true,
          true,
        );
      }
    };

    const handleAutoAbandoned = (data: { scooterId: string; message: string }) => {
      if (activeTripRef.current?.scooterId !== data.scooterId) return;

      keysPressedRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      setIsManualControl(false);
      setShowJoystick(false);
      setActiveTrip(null);
      setIsEmergencyLocked(false);
      alarmSoundRef.current.stop();
      setIsAlarmAudioActive(false);
      setSystemBanner(data.message);
      if (mapInstanceRef.current?.keyboard) {
        mapInstanceRef.current.keyboard.enable();
      }
      loadInitialFleet();
    };

    const handleResetEvent = () => {
      keysPressedRef.current.clear();
      joystickVectorRef.current = { x: 0, y: 0 };
      setIsManualControl(false);
      setShowJoystick(false);
      setActiveTrip(null);
      setIsEmergencyLocked(false);
      setAlarmReason(null);
      alarmSoundRef.current.stop();
      setIsAlarmAudioActive(false);
      setLiveTelemetry(null);
      setIdleSecondsOutsideParking(0);
      loadInitialFleet();
    };

    socket.on('telemetry:broadcast', handleTelemetry);
    socket.on('scooter:emergency_stop', handleEmergencyStop);
    socket.on('trip:auto_abandoned', handleAutoAbandoned);
    socket.on('scooter:reset', handleResetEvent);

    return () => {
      socket.off('telemetry:broadcast', handleTelemetry);
      socket.off('scooter:emergency_stop', handleEmergencyStop);
      socket.off('trip:auto_abandoned', handleAutoAbandoned);
      socket.off('scooter:reset', handleResetEvent);
    };
  }, [activeTrip?.scooterId, loadInitialFleet, updateScooterMarker]);

  // 4. Listeners de teclado (WASD y Flechas) cuando el control manual está activo
  useEffect(() => {
    if (!isManualControl) {
      keysPressedRef.current.clear();
      return;
    }

    const CONTROL_KEYS = new Set([
      'w',
      'a',
      's',
      'd',
      'W',
      'A',
      'S',
      'D',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (CONTROL_KEYS.has(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        keysPressedRef.current.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (CONTROL_KEYS.has(e.key)) {
        keysPressedRef.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      }
    };

    const handleBlur = () => {
      keysPressedRef.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
    };
  }, [isManualControl]);

  // 5. Bucle de física en tiempo real para control WASD / Flechas / Joystick
  useEffect(() => {
    if (!isManualControl || !activeTrip || isEmergencyLocked) return;

    const scooterId = activeTrip.scooterId;
    const DT_SEC = 0.05; // 20 FPS

    // Asegurar punto inicial válido en memoria
    if (!scooterStatesRef.current[scooterId]) {
      const fallbackLat = liveTelemetry?.lat ?? 11.0182;
      const fallbackLng = liveTelemetry?.lng ?? -74.7952;
      const fallbackBat = liveTelemetry?.battery ?? 85;
      scooterStatesRef.current[scooterId] = {
        lat: fallbackLat,
        lng: fallbackLng,
        battery: fallbackBat,
        speed: 0,
        locked: false,
      };
    }

    const socket = getSocket();

    const intervalId = window.setInterval(() => {
      if (!isManualControlRef.current || isEmergencyLockedRef.current) return;

      const state = scooterStatesRef.current[scooterId];
      if (!state) return;

      // Leer teclado WASD / Flechas
      const keys = keysPressedRef.current;
      let kx = 0;
      let ky = 0;
      if (keys.has('w') || keys.has('ArrowUp')) ky += 1;
      if (keys.has('s') || keys.has('ArrowDown')) ky -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) kx += 1;
      if (keys.has('a') || keys.has('ArrowLeft')) kx -= 1;

      if (kx !== 0 && ky !== 0) {
        const norm = Math.hypot(kx, ky);
        kx /= norm;
        ky /= norm;
      }

      // Combinar teclado con Joystick táctil
      const jv = joystickVectorRef.current;
      let vx = kx !== 0 || ky !== 0 ? kx : jv.x;
      let vy = kx !== 0 || ky !== 0 ? ky : jv.y;

      const mag = Math.min(1, Math.hypot(vx, vy));
      if (mag > 1) {
        vx /= mag;
        vy /= mag;
      }

      const currentGeo = evaluateGeofence(state.lat, state.lng);

      // Si ya se encuentra fuera del perímetro, activar parada inmediata + candado + alarma
      if (!currentGeo.insidePerimeter) {
        state.speed = 0;
        state.locked = true;
        isEmergencyLockedRef.current = true;
        setIsEmergencyLocked(true);
        setIsManualControl(false);
        setShowJoystick(false);
        setAlarmReason(
          'Saliste de los límites del Gran Malecón. Motor apagado, candado cerrado y alarma 85 dB activada.',
        );
        alarmSoundRef.current.start();
        setIsAlarmAudioActive(true);
        if (mapInstanceRef.current?.keyboard) {
          mapInstanceRef.current.keyboard.enable();
        }
        socket.emit('telemetry:update', {
          scooterId,
          lat: state.lat,
          lng: state.lng,
          speed: 0,
          battery: Math.round(state.battery),
          locked: false,
        });
        updateScooterMarker(scooterId, state.lat, state.lng, 0, state.battery, true, true);
        return;
      }

      // Si se agotó la batería completamente, apagar motor
      if (state.battery <= 0) {
        state.speed = 0;
        vx = 0;
        vy = 0;
      }

      // Calcular velocidad con límite estricto de zona (10 peatonal/parqueo, 20 normal)
      const targetSpeed = mag * currentGeo.maxSpeed;
      let nextSpeed = state.speed;
      if (targetSpeed > nextSpeed) {
        nextSpeed = Math.min(targetSpeed, nextSpeed + 4.0);
      } else {
        nextSpeed = Math.max(targetSpeed, nextSpeed - 5.0);
      }
      nextSpeed = Number(Math.min(nextSpeed, currentGeo.maxSpeed).toFixed(1));
      if (mag === 0 && nextSpeed < 0.3) {
        nextSpeed = 0;
      }

      // Calcular nueva posición en el mapa
      let nextLat = state.lat;
      let nextLng = state.lng;
      if (mag > 0.02 && nextSpeed > 0 && state.battery > 0) {
        const dirX = vx / mag;
        const dirY = vy / mag;
        const distDeg = nextSpeed * DEG_PER_KMH_PER_SEC * DT_SEC;
        nextLat += dirY * distDeg;
        nextLng += dirX * distDeg;

        batteryFracRef.current += distDeg * BATTERY_DROP_PER_DEG;
        if (batteryFracRef.current >= 0.1) {
          const drop = Math.floor(batteryFracRef.current * 10) / 10;
          state.battery = Math.max(0, Number((state.battery - drop).toFixed(2)));
          batteryFracRef.current -= drop;
        }
      }

      const nextGeo = evaluateGeofence(nextLat, nextLng);
      const now = Date.now();

      // Verificar cruce de límite del perímetro en este paso
      if (!nextGeo.insidePerimeter) {
        state.lat = nextLat;
        state.lng = nextLng;
        state.speed = 0;
        state.locked = true;
        isEmergencyLockedRef.current = true;
        setIsEmergencyLocked(true);
        setIsManualControl(false);
        setShowJoystick(false);
        setAlarmReason(
          'Saliste de los límites del Gran Malecón. Motor apagado, candado cerrado y alarma 85 dB activada.',
        );
        alarmSoundRef.current.start();
        setIsAlarmAudioActive(true);
        if (mapInstanceRef.current?.keyboard) {
          mapInstanceRef.current.keyboard.enable();
        }

        const outPayload: TelemetryBroadcast = {
          scooterId,
          lat: nextLat,
          lng: nextLng,
          speed: 0,
          battery: Math.round(state.battery),
          locked: true,
          zoneName: 'Fuera del Gran Malecón',
          zoneType: 'prohibida',
          maxSpeed: 0,
          isInsideParkingZone: false,
          emergencyStopped: true,
          timestamp: new Date().toISOString(),
        };
        setLiveTelemetry(outPayload);
        updateScooterMarker(scooterId, nextLat, nextLng, 0, state.battery, true, true);

        // Enviar locked: false en el paquete que cruza el límite para que el backend registre 'fuera_perimetro', bloquee BD y alerte al Dashboard
        socket.emit('telemetry:update', {
          scooterId,
          lat: nextLat,
          lng: nextLng,
          speed: 0,
          battery: Math.round(state.battery),
          locked: false,
        });
        return;
      }

      // Clamping inmediato de velocidad si acaba de entrar en zona peatonal o estación
      nextSpeed = Number(Math.min(nextSpeed, nextGeo.maxSpeed).toFixed(1));
      state.lat = nextLat;
      state.lng = nextLng;
      state.speed = nextSpeed;
      state.locked = false;

      // Actualizar marcador suavemente en Leaflet
      updateScooterMarker(scooterId, nextLat, nextLng, nextSpeed, state.battery, false, false);

      // Seguir suavemente solo si el monopatín se acerca al borde de la vista actual
      if (mapInstanceRef.current) {
        const padded = mapInstanceRef.current.getBounds().pad(-0.18);
        if (!padded.contains([nextLat, nextLng])) {
          mapInstanceRef.current.panTo([nextLat, nextLng], { animate: true, duration: 0.25 });
        }
      }

      // Contador de inactividad fuera de estación para advertir al usuario
      if (nextSpeed <= 0.5 && !nextGeo.isParkingZone) {
        if (!idleOutsideSinceRef.current) {
          idleOutsideSinceRef.current = now;
        }
        const idleSecs = Math.floor((now - idleOutsideSinceRef.current) / 1000);
        if (idleSecs !== idleSecondsOutsideParking) {
          setIdleSecondsOutsideParking(idleSecs);
        }
      } else {
        idleOutsideSinceRef.current = null;
        if (idleSecondsOutsideParking !== 0) {
          setIdleSecondsOutsideParking(0);
        }
      }

      const zoneChanged = lastZoneTypeRef.current !== `${nextGeo.zoneType}:${nextGeo.zoneName}`;
      lastZoneTypeRef.current = `${nextGeo.zoneType}:${nextGeo.zoneName}`;

      // Sincronizar HUD del panel (~100ms o inmediato si cambió zona)
      if (zoneChanged || now - lastUiSyncAtRef.current >= 100) {
        lastUiSyncAtRef.current = now;
        setLiveTelemetry({
          scooterId,
          lat: nextLat,
          lng: nextLng,
          speed: nextSpeed,
          battery: Math.round(state.battery),
          locked: false,
          zoneName: nextGeo.zoneName,
          zoneType: nextGeo.zoneType,
          maxSpeed: nextGeo.maxSpeed,
          isInsideParkingZone: nextGeo.isParkingZone,
          emergencyStopped: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Enviar telemetría al servidor (~300ms en movimiento, inmediato al cambiar zona, o cada 4s en reposo)
      const isActiveMotion = mag > 0.02 || nextSpeed > 0.3;
      if (
        zoneChanged ||
        (isActiveMotion && now - lastEmitAtRef.current >= 300) ||
        now - lastEmitAtRef.current >= 4000
      ) {
        lastEmitAtRef.current = now;
        socket.emit('telemetry:update', {
          scooterId,
          lat: nextLat,
          lng: nextLng,
          speed: nextSpeed,
          battery: Math.round(state.battery),
          locked: false,
        });
      }
    }, 50);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    activeTrip,
    idleSecondsOutsideParking,
    isEmergencyLocked,
    isManualControl,
    liveTelemetry?.battery,
    liveTelemetry?.lat,
    liveTelemetry?.lng,
    updateScooterMarker,
  ]);

  // 6. Acciones de control manual simulado y joystick
  const handleStartManualControl = useCallback(() => {
    const trip = activeTripRef.current;
    if (!trip || isEmergencyLockedRef.current) return;

    alarmSoundRef.current.unlock();
    setSystemBanner(null);

    if (mapInstanceRef.current?.keyboard) {
      mapInstanceRef.current.keyboard.disable();
    }

    const existing = scooterStatesRef.current[trip.scooterId] || {
      lat: liveTelemetry?.lat ?? 11.0182,
      lng: liveTelemetry?.lng ?? -74.7952,
      battery: liveTelemetry?.battery ?? 85,
      speed: 0,
      locked: false,
    };
    existing.locked = false;
    scooterStatesRef.current[trip.scooterId] = existing;

    const geo = evaluateGeofence(existing.lat, existing.lng);
    setLiveTelemetry({
      scooterId: trip.scooterId,
      lat: existing.lat,
      lng: existing.lng,
      speed: existing.speed,
      battery: Math.round(existing.battery),
      locked: false,
      zoneName: geo.zoneName,
      zoneType: geo.zoneType,
      maxSpeed: geo.maxSpeed,
      isInsideParkingZone: geo.isParkingZone,
      emergencyStopped: !geo.insidePerimeter,
      timestamp: new Date().toISOString(),
    });

    setIsManualControl(true);
    lastEmitAtRef.current = 0;

    getSocket().emit('simulator:control_mode', {
      scooterId: trip.scooterId,
      manual: true,
      lat: existing.lat,
      lng: existing.lng,
      battery: Math.round(existing.battery),
    });
  }, [liveTelemetry]);

  const handleStopManualControl = useCallback(() => {
    stopManualModeAndNotify(true);
  }, [stopManualModeAndNotify]);

  const handleToggleJoystick = useCallback(() => {
    alarmSoundRef.current.unlock();
    if (!showJoystick) {
      if (!isManualControlRef.current && !isEmergencyLockedRef.current) {
        handleStartManualControl();
      }
      setShowJoystick(true);
    } else {
      joystickVectorRef.current = { x: 0, y: 0 };
      setShowJoystick(false);
    }
  }, [handleStartManualControl, showJoystick]);

  // 7. Iniciar Viaje (con soporte para forzar cierre si existe un viaje anterior colgado)
  const handleUnlockScooter = async (scooterId: string, forzarCierreAnterior = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSystemBanner(null);
    try {
      const res = await startTrip(scooterId, forzarCierreAnterior, activeUserId);
      setActiveTrip(res.data);
      setIsScannerOpen(false);
      setIsEmergencyLocked(false);
      setAlarmReason(null);
      setIdleSecondsOutsideParking(0);
      stopAlarm();

      joinRoom('client_trips', scooterId);

      const pos = scooterStatesRef.current[scooterId];
      if (pos) {
        pos.locked = false;
        const geo = evaluateGeofence(pos.lat, pos.lng);
        setLiveTelemetry({
          scooterId,
          lat: pos.lat,
          lng: pos.lng,
          speed: 0,
          battery: Math.round(pos.battery),
          locked: false,
          zoneName: geo.zoneName,
          zoneType: geo.zoneType,
          maxSpeed: geo.maxSpeed,
          isInsideParkingZone: geo.isParkingZone,
          emergencyStopped: false,
          timestamp: new Date().toISOString(),
        });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([pos.lat, pos.lng], 17);
        }
      } else if (liveTelemetry && mapInstanceRef.current) {
        mapInstanceRef.current.setView([liveTelemetry.lat, liveTelemetry.lng], 17);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al desbloquear monopatín');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Finalizar Viaje con validación de geocerca PostGIS (y soporte de abandono con multa)
  const handleConfirmEndTrip = async (fotoUrl: string, forzarAbandono = false) => {
    if (!activeTrip) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await endTrip(activeTrip.viajeId, fotoUrl, forzarAbandono);
      stopManualModeAndNotify(false);
      stopAlarm();
      setIsEmergencyLocked(false);
      setAlarmReason(null);
      setReceipt(res.data);
      setActiveTrip(null);
      setIsEndModalOpen(false);
      loadInitialFleet();
    } catch (err: any) {
      setErrorMessage(err.message || 'No fue posible finalizar el viaje');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset rápido para pruebas de desarrollo
  const handleDevReset = async () => {
    if (window.confirm('¿Deseas reiniciar los viajes de prueba y liberar todos los monopatines?')) {
      stopManualModeAndNotify(false);
      stopAlarm();
      await resetDevTrips();
      setActiveTrip(null);
      setIsEmergencyLocked(false);
      setAlarmReason(null);
      setErrorMessage(null);
      setSystemBanner(null);
      setLiveTelemetry(null);
      await loadInitialFleet();
      alert('Ambiente reiniciado: Monopatines en estado disponible en sus estaciones.');
    }
  };

  const currentMaxSpeed =
    liveTelemetry?.maxSpeed ??
    (liveTelemetry?.zoneType === 'peatonal' || liveTelemetry?.isInsideParkingZone ? 10 : 20);

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

      {/* Notificación flotante de cierre automático o alerta del sistema */}
      {systemBanner && (
        <div className="absolute top-20 inset-x-4 z-30 max-w-md mx-auto p-3 rounded-2xl bg-rose-950/95 border border-rose-600 text-rose-100 text-xs shadow-2xl flex items-start justify-between gap-2">
          <span>{systemBanner}</span>
          <button
            type="button"
            onClick={() => setSystemBanner(null)}
            className="text-rose-300 hover:text-white font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Joystick flotante en pantalla (ideal para móvil / táctil) */}
      {activeTrip && showJoystick && !isEmergencyLocked && (
        <div
          className={`fixed ${
            isTripPanelMinimized ? 'bottom-20' : 'bottom-[340px]'
          } right-3 sm:bottom-5 sm:right-5 z-40 transition-all duration-200 animate-fadeIn`}
        >
          <JoystickControl
            onVectorChange={(vec) => {
              joystickVectorRef.current = vec;
            }}
            onClose={() => {
              joystickVectorRef.current = { x: 0, y: 0 };
              setShowJoystick(false);
            }}
            disabled={isEmergencyLocked}
            maxSpeed={currentMaxSpeed}
          />
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
          isManualControl={isManualControl}
          onStartManualControl={handleStartManualControl}
          onStopManualControl={handleStopManualControl}
          showJoystick={showJoystick}
          onToggleJoystick={handleToggleJoystick}
          isEmergencyLocked={isEmergencyLocked}
          alarmReason={alarmReason}
          isAlarmAudioActive={isAlarmAudioActive}
          onSilenceAlarm={stopAlarm}
          idleSecondsOutsideParking={idleSecondsOutsideParking}
          isMinimized={isTripPanelMinimized}
          onMinimizedChange={setIsTripPanelMinimized}
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
