// frontend/src/components/ActiveTripPanel.tsx

import React, { useEffect, useState } from 'react';
import { Clock, Gauge, BatteryCharging, MapPin, ShieldAlert, Lock } from 'lucide-react';
import { ActiveTrip, TelemetryBroadcast } from '../types';

interface ActiveTripPanelProps {
  trip: ActiveTrip;
  telemetry: TelemetryBroadcast | null;
  onEndTripClick: () => void;
}

export const ActiveTripPanel: React.FC<ActiveTripPanelProps> = ({
  trip,
  telemetry,
  onEndTripClick,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Cronómetro en tiempo real sincronizado con inicioViaje
  useEffect(() => {
    const startTime = new Date(trip.inicioViaje).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    }, 1000);

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

  const isPedestrian = currentZone.toLowerCase().includes('peatonal');

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-slate-900/95 border-t border-slate-700 backdrop-blur-md shadow-2xl rounded-t-3xl max-w-lg mx-auto transition-all animate-slideUp">
      {/* Top indicator bar */}
      <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-3" />

      {/* Header Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-white text-sm sm:text-base tracking-wide">
            Viaje Activo: <span className="text-emerald-400 font-mono">{trip.scooterId}</span>
          </span>
        </div>

        {/* Zona Geocerca Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isPedestrian
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate max-w-[130px]">{currentZone}</span>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Cronómetro */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-xl text-center">
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
        <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Velocidad</span>
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {speed} <span className="text-xs font-normal text-slate-400">km/h</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {isPedestrian ? 'Máx 10 km/h' : 'Máx 20 km/h'}
          </div>
        </div>

        {/* Batería */}
        <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-xl text-center">
          <div className="flex items-center justify-center gap-1 text-slate-400 text-xs mb-0.5">
            <BatteryCharging
              className={`w-3.5 h-3.5 ${
                battery < 20 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            />
            <span>Batería</span>
          </div>
          <div
            className={`text-lg font-mono font-bold ${
              battery < 20 ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {battery}%
          </div>
          <div className="text-[10px] text-slate-400">Autonomía OK</div>
        </div>
      </div>

      {/* Botón Finalizar Viaje */}
      <button
        onClick={onEndTripClick}
        className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition active:scale-[0.99]"
      >
        <Lock className="w-4 h-4" />
        <span>Finalizar Viaje y Parquear</span>
      </button>
    </div>
  );
};

