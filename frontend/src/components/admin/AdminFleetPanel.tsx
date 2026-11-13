// frontend/src/components/admin/AdminFleetPanel.tsx
import React from 'react';
import {
  AlertTriangle,
  Battery,
  Crosshair,
  MapPin,
  User,
  Wrench,
} from 'lucide-react';
import { AdminFleetUnit } from '../../types';

export type FleetFilter = 'all' | 'in_use' | 'out_of_zone' | 'maintenance';

interface AdminFleetPanelProps {
  fleet: AdminFleetUnit[];
  filter: FleetFilter;
  onFilterChange: (filter: FleetFilter) => void;
  selectedScooterId: string | null;
  followScooterId: string | null;
  onSelectScooter: (unit: AdminFleetUnit) => void;
}

export const AdminFleetPanel: React.FC<AdminFleetPanelProps> = ({
  fleet,
  filter,
  onFilterChange,
  selectedScooterId,
  followScooterId,
  onSelectScooter,
}) => {
  const counts = {
    all: fleet.length,
    in_use: fleet.filter((u) => u.estado === 'en uso').length,
    out_of_zone: fleet.filter((u) => u.outOfPerimeter || u.estado === 'bloqueado').length,
    maintenance: fleet.filter((u) => u.estado === 'mantenimiento' || u.battery < 20).length,
  };

  const filtered = fleet.filter((u) => {
    if (filter === 'in_use') return u.estado === 'en uso';
    if (filter === 'out_of_zone') return u.outOfPerimeter || u.estado === 'bloqueado';
    if (filter === 'maintenance') return u.estado === 'mantenimiento' || u.battery < 20;
    return true;
  });

  const filterButtons: Array<{ key: FleetFilter; label: string; count: number; alert?: boolean }> = [
    { key: 'all', label: 'Todos', count: counts.all },
    { key: 'in_use', label: 'En Ruta', count: counts.in_use },
    {
      key: 'out_of_zone',
      label: 'Fuera Zona',
      count: counts.out_of_zone,
      alert: counts.out_of_zone > 0,
    },
    { key: 'maintenance', label: 'Mant. / Bat.', count: counts.maintenance },
  ];

  return (
    <div className="flex flex-col min-h-0">
      {/* Filtros rápidos */}
      <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap gap-1.5 bg-slate-900/50">
        {filterButtons.map((btn) => {
          const active = filter === btn.key;
          return (
            <button
              key={btn.key}
              type="button"
              onClick={() => onFilterChange(btn.key)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition ${
                active
                  ? btn.alert
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-cyan-600 text-white border-cyan-400'
                  : btn.alert
                  ? 'bg-rose-950/50 text-rose-300 border-rose-800/70 hover:bg-rose-900/50'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>{btn.label}</span>
              <span className="font-mono opacity-85">({btn.count})</span>
            </button>
          );
        })}
      </div>

      {/* Lista de unidades */}
      <div className="p-2.5 space-y-2 overflow-y-auto max-h-60 lg:max-h-72">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No hay unidades en esta categoría
          </div>
        ) : (
          filtered.map((scooter) => {
            const isOutOfZone = Boolean(scooter.outOfPerimeter);
            const isBlocked = scooter.estado === 'bloqueado';
            const isMaintenance = scooter.estado === 'mantenimiento';
            const isInUse = scooter.estado === 'en uso';
            const isSelected = selectedScooterId === scooter.scooterId;
            const isFollowing = followScooterId === scooter.scooterId;

            const cardBorderClass = isSelected
              ? 'border-cyan-400 bg-slate-800/95 ring-1 ring-cyan-500/40'
              : isOutOfZone || isBlocked
              ? 'border-rose-500/70 bg-rose-950/30 hover:bg-rose-950/45'
              : isMaintenance
              ? 'border-amber-500/50 bg-amber-950/20 hover:bg-amber-950/35'
              : 'border-slate-700/60 bg-slate-800/70 hover:bg-slate-800';

            return (
              <button
                key={scooter.scooterId}
                type="button"
                onClick={() => onSelectScooter(scooter)}
                className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 text-xs ${cardBorderClass}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-white font-mono">{scooter.scooterId}</span>

                    {isOutOfZone ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-600 text-white border border-rose-400 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        FUERA DE ZONA
                      </span>
                    ) : isBlocked ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                        BLOQUEADO
                      </span>
                    ) : isMaintenance ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <Wrench className="w-2.5 h-2.5" />
                        MANTENIMIENTO
                      </span>
                    ) : isInUse ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        EN RUTA
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        DISPONIBLE
                      </span>
                    )}

                    {scooter.pendingMaintenance && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/70 text-amber-200 border border-amber-700">
                        Mant. prog.
                      </span>
                    )}

                    {isFollowing && (
                      <Crosshair className="w-3 h-3 text-cyan-400 animate-spin" />
                    )}
                  </div>

                  <div
                    className={`text-[10px] truncate mt-1 flex items-center gap-1 ${
                      isOutOfZone ? 'text-rose-300 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{scooter.zoneName}</span>
                  </div>

                  {scooter.activeRiderName && (
                    <div className="text-[10px] text-cyan-300 truncate mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{scooter.activeRiderName}</span>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono text-xs font-bold text-slate-200">
                    {scooter.speed} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                  </div>
                  <div
                    className={`flex items-center gap-1 text-[10px] justify-end mt-0.5 font-mono ${
                      scooter.battery < 15
                        ? 'text-rose-400 font-bold'
                        : scooter.battery < 20
                        ? 'text-amber-300 font-semibold'
                        : 'text-emerald-400'
                    }`}
                  >
                    <Battery className="w-3 h-3" />
                    <span>{scooter.battery}%</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

