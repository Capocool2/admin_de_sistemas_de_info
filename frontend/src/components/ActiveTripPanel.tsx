// frontend/src/components/ActiveTripPanel.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Gauge,
  BatteryCharging,
  MapPin,
  Lock,
  Gamepad2,
  Square,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ActiveTrip, TelemetryBroadcast } from '../types';

interface ActiveTripPanelProps {
  trip: ActiveTrip;
  telemetry: TelemetryBroadcast | null;
  onEndTripClick: () => void;
  isManualControl: boolean;
  onStartManualControl: () => void;
  onStopManualControl: () => void;
  showJoystick: boolean;
  onToggleJoystick: () => void;
  isEmergencyLocked: boolean;
  alarmReason: string | null;
  isAlarmAudioActive: boolean;
  onSilenceAlarm: () => void;
  idleSecondsOutsideParking: number;
  isMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}

export const ActiveTripPanel: React.FC<ActiveTripPanelProps> = ({
  trip,
  telemetry,
  onEndTripClick,
  isManualControl,
  onStartManualControl,
  onStopManualControl,
  showJoystick,
  onToggleJoystick,
  isEmergencyLocked,
  alarmReason,
  isAlarmAudioActive,
  onSilenceAlarm,
  idleSecondsOutsideParking,
  isMinimized,
  onMinimizedChange,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [internalMinimized, setInternalMinimized] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartYRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

  const minimized = isMinimized ?? internalMinimized;
  const setMinimized = (next: boolean) => {
    if (isMinimized === undefined) {
      setInternalMinimized(next);
    }
    onMinimizedChange?.(next);
  };

  // Expandir automáticamente si se activa la alarma de emergencia
  useEffect(() => {
    if (isEmergencyLocked) {
      if (isMinimized === undefined) {
        setInternalMinimized(false);
      }
      onMinimizedChange?.(false);
    }
  }, [isEmergencyLocked, isMinimized, onMinimizedChange]);

  // Cronómetro en tiempo real sincronizado con inicioViaje
  useEffect(() => {
    const startTime = new Date(trip.inicioViaje).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [trip.inicioViaje]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const minutesCharged = Math.max(1, Math.ceil(elapsedSeconds / 60));
  const estimatedCost = minutesCharged * (trip.tarifaMinutoCOP || 500);

  const speed = telemetry ? telemetry.speed : 0;
  const battery = telemetry ? telemetry.battery : 85;
  const currentZone = telemetry?.zoneName || 'Sector Malecón';

  const isPedestrian =
    telemetry?.zoneType === 'peatonal' || currentZone.toLowerCase().includes('peatonal');
  const isParking =
    Boolean(telemetry?.isInsideParkingZone) || telemetry?.zoneType === 'parqueo';
  const maxAllowedSpeed =
    telemetry?.maxSpeed ?? (isPedestrian || isParking ? 10 : 20);
  const batteryDepleted = battery <= 0;

  const zoneBadgeClasses = isEmergencyLocked
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
    : isParking
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : isPedestrian
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    dragDeltaRef.current = 0;
    setIsDragging(true);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    dragDeltaRef.current = delta;
    const clamped = minimized
      ? Math.max(-110, Math.min(20, delta))
      : Math.max(-16, Math.min(220, delta));
    setDragOffsetY(clamped);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const delta = dragDeltaRef.current;
    dragStartYRef.current = null;
    dragDeltaRef.current = 0;
    setIsDragging(false);
    setDragOffsetY(0);

    const tappedHandle = Boolean(
      (e.target as HTMLElement).closest('[data-drag-handle="true"]'),
    );

    if (Math.abs(delta) < 6) {
      if (minimized || tappedHandle) {
        setMinimized(!minimized);
      }
    } else if (!minimized && delta > 45) {
      setMinimized(true);
    } else if (minimized && delta < -30) {
      setMinimized(false);
    }
  };

  return (
    <div
      style={dragOffsetY !== 0 ? { transform: `translateY(${dragOffsetY}px)` } : undefined}
      className={`fixed bottom-0 inset-x-0 z-40 ${
        minimized ? 'px-3 pt-1.5 pb-2.5' : 'p-3 sm:p-4'
      } bg-slate-900/95 border-t border-slate-700 backdrop-blur-md shadow-2xl rounded-t-3xl max-w-lg mx-auto ${
        isDragging ? '' : 'transition-all duration-200'
      }`}
    >
      {/* Zona superior arrastrable (barra indicadora + encabezado) */}
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        className="cursor-grab active:cursor-grabbing touch-none select-none"
      >
        {/* Top indicator grab bar */}
        <div
          data-drag-handle="true"
          title={
            minimized
              ? 'Toca o desliza hacia arriba para expandir'
              : 'Toca o desliza hacia abajo para bajar la barra'
          }
          className={`pt-1.5 pb-2 -mt-1 flex justify-center group ${
            minimized ? 'mb-1' : 'mb-1.5'
          }`}
        >
          <div className="w-14 h-1.5 bg-slate-600 group-hover:bg-slate-400 rounded-full transition-colors" />
        </div>

        {minimized ? (
          /* Barra compacta minimizada en la parte inferior */
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isEmergencyLocked ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isEmergencyLocked ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                ></span>
              </span>
              <span className="font-bold text-emerald-400 font-mono text-xs sm:text-sm shrink-0">
                {trip.scooterId}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 truncate">
                <span>{formatTimer(elapsedSeconds)}</span>
                <span className="text-slate-600">•</span>
                <span>{speed} km/h</span>
                <span className="text-slate-600">•</span>
                <span
                  className={
                    battery < 15
                      ? 'text-rose-400'
                      : battery < 20
                      ? 'text-amber-300'
                      : 'text-emerald-300'
                  }
                >
                  {battery}%
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-slate-300 hidden sm:inline">
                  ${estimatedCost.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${zoneBadgeClasses}`}
              >
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[95px]">{currentZone}</span>
              </span>
              <button
                type="button"
                onClick={() => setMinimized(false)}
                aria-label="Subir panel del viaje"
                title="Subir panel del viaje"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition active:scale-95"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Header Info expandido */
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isEmergencyLocked ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isEmergencyLocked ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                ></span>
              </span>
              <span className="font-bold text-white text-sm sm:text-base tracking-wide truncate">
                Viaje Activo:{' '}
                <span className="text-emerald-400 font-mono">{trip.scooterId}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Zona Geocerca Indicator */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${zoneBadgeClasses}`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[125px]">{currentZone}</span>
              </div>

              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Bajar panel del viaje"
                title="Bajar barra para ver mejor el mapa"
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition active:scale-95"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {!minimized && (
        <>

      {/* Alarma de Perímetro / Parada de Emergencia */}
      {isEmergencyLocked && (
        <div className="mb-2.5 p-2.5 rounded-xl bg-rose-950/90 border border-rose-600/80 text-rose-200 text-xs flex items-start justify-between gap-2 animate-pulse">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-300">
                🚨 ALARMA ENCENDIDA (85 dB) • MOTOR APAGADO • CANDADO CERRADO
              </p>
              <p className="text-[11px] text-rose-200/90 mt-0.5 leading-tight">
                {alarmReason || 'Saliste de los límites del Gran Malecón.'}
              </p>
            </div>
          </div>
          {isAlarmAudioActive && (
            <button
              type="button"
              onClick={onSilenceAlarm}
              className="px-2 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-[10px] font-semibold flex items-center gap-1 shrink-0"
            >
              <VolumeX className="w-3 h-3" />
              <span>Silenciar</span>
            </button>
          )}
        </div>
      )}

      {/* Aviso positivo de estación autorizada / límite peatonal / inactividad */}
      {!isEmergencyLocked && isParking && (
        <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span>Dentro de Estación Autorizada: ya puedes finalizar tu viaje sin multa.</span>
        </div>
      )}

      {!isEmergencyLocked && !isParking && idleSecondsOutsideParking >= 15 && (
        <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-amber-950/70 border border-amber-700/60 text-amber-200 text-[11px] flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>
            Inactivo fuera de estación ({idleSecondsOutsideParking}s/30s): se cerrará por abandono con multa de $15.000 COP si no avanzas.
          </span>
        </div>
      )}

      {/* Métricas Principales */}
      <div className="grid grid-cols-3 gap-2 mb-2.5">
        {/* Cronómetro */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-2 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tiempo</span>
          </div>
          <div className="text-lg font-mono font-bold text-white tracking-wider">
            {formatTimer(elapsedSeconds)}
          </div>
          <div className="text-[10px] text-slate-400">${estimatedCost.toLocaleString()} COP</div>
        </div>

        {/* Velocímetro en vivo */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-2 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Velocidad</span>
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {speed} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div
            className={`text-[10px] font-medium ${
              isEmergencyLocked
                ? 'text-rose-400'
                : isPedestrian
                ? 'text-amber-300'
                : 'text-slate-400'
            }`}
          >
            {isEmergencyLocked
              ? 'Motor apagado'
              : isPedestrian
              ? `Zona peatonal · Máx ${maxAllowedSpeed} km/h`
              : `Máx ${maxAllowedSpeed} km/h`}
          </div>
        </div>

        {/* Batería */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-2 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5">
            <BatteryCharging
              className={`w-3.5 h-3.5 ${
                battery < 15 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            />
            <span>Batería</span>
          </div>
          <div
            className={`text-lg font-mono font-bold ${
              battery < 15
                ? 'text-rose-400'
                : battery < 20
                ? 'text-amber-300'
                : 'text-emerald-300'
            }`}
          >
            {battery}%
          </div>
          <div className="text-[10px] text-slate-400">
            {batteryDepleted
              ? 'Sin carga'
              : battery < 15
              ? 'Crítica (<15%)'
              : 'Autonomía OK'}
          </div>
        </div>
      </div>

      {/* Controles de Viaje Simulado (WASD / Flechas / Joystick) */}
      {!isEmergencyLocked && !batteryDepleted && (
        <div className="mb-2.5 space-y-1.5">
          {isManualControl && (
            <div className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/50 text-[11px] text-cyan-200 flex items-center justify-between">
              <span>🎮 Control manual activo: usa <strong>WASD</strong> o las <strong>Flechas</strong></span>
              <span className="text-[10px] text-cyan-400 font-semibold">Random pausado</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!isManualControl ? (
              <button
                type="button"
                onClick={onStartManualControl}
                className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition active:scale-[0.98]"
              >
                <Gamepad2 className="w-4 h-4 shrink-0" />
                <span>Controlar viaje simulado</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopManualControl}
                className="py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition active:scale-[0.98]"
              >
                <Square className="w-3.5 h-3.5 shrink-0 fill-current" />
                <span>Finalizar viaje simulado</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleJoystick}
              className={`py-2.5 px-3 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 border transition active:scale-[0.98] ${
                showJoystick
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/60 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>{showJoystick ? 'Ocultar joystick' : 'Mostrar joystick'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Botón Finalizar Viaje Real */}
      <button
        onClick={onEndTripClick}
        className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition active:scale-[0.99]"
      >
        <Lock className="w-4 h-4" />
        <span>Finalizar Viaje y Parquear</span>
      </button>
        </>
      )}
    </div>
  );
};
