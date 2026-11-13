// frontend/src/components/admin/AdminUsersZonesTab.tsx
import React, { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Gauge,
  MapPin,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import { AdminUserRecord, AdminZoneRecord } from '../../types';

interface AdminUsersZonesTabProps {
  users: AdminUserRecord[];
  zones: AdminZoneRecord[];
  isBusy: boolean;
  onToggleUserStatus: (user: AdminUserRecord) => Promise<void>;
  onSaveZone: (
    zoneId: string,
    payload: {
      limite_velocidad?: number;
      tarifa_minuto?: number;
      applyRateToAllZones?: boolean;
    },
  ) => Promise<void>;
}

export const AdminUsersZonesTab: React.FC<AdminUsersZonesTabProps> = ({
  users,
  zones,
  isBusy,
  onToggleUserStatus,
  onSaveZone,
}) => {
  const [draftZones, setDraftZones] = useState<
    Record<string, { speed: number; rate: number; applyAll: boolean }>
  >({});

  const getDraft = (z: AdminZoneRecord) =>
    draftZones[z.id] ?? {
      speed: Number(z.limite_velocidad) || 10,
      rate: Number(z.tarifa_minuto) || 500,
      applyAll: z.tipo === 'normal',
    };

  const setDraftField = (
    z: AdminZoneRecord,
    patch: Partial<{ speed: number; rate: number; applyAll: boolean }>,
  ) => {
    const current = getDraft(z);
    setDraftZones((prev) => ({
      ...prev,
      [z.id]: { ...current, ...patch },
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-950">
      {/* Columna 1: Gestión de Cuentas */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Cuentas de Turistas y Operadores</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">{users.length} cuentas</span>
        </div>

        <div className="p-3 space-y-2 overflow-y-auto max-h-[540px]">
          {users.map((u) => {
            const isAdmin = u.rol === 'admin';
            const isBlocked = u.estado === 'bloqueado';

            return (
              <div
                key={u.id}
                className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white truncate">{u.nombre_completo}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        isAdmin
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {u.rol}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        isBlocked
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {u.estado}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.correo}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    {u.total_viajes} viajes • ${Number(u.gasto_total || 0).toLocaleString('es-CO')} COP
                  </div>
                </div>

                {isAdmin ? (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-cyan-400 flex items-center gap-1 shrink-0">
                    <Shield className="w-3 h-3" />
                    Protegido
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy || u.viajes_activos > 0}
                    title={
                      u.viajes_activos > 0
                        ? 'No se puede suspender mientras tiene un viaje activo'
                        : isBlocked
                        ? 'Rehabilitar cuenta de turista'
                        : 'Suspender cuenta por incidencia comprobada'
                    }
                    onClick={() => onToggleUserStatus(u)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 transition disabled:opacity-40 ${
                      isBlocked
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Habilitar</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" />
                        <span>Suspender</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Columna 2: Zonas Geocercas y Tarifas */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col overflow-hidden">
        <div className="p-3.5 border-b border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>Reglas PostGIS: Velocidades y Tarifas</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Los ajustes de tarifa aplican únicamente a viajes nuevos; los viajes en curso conservan la tarifa con la que iniciaron.
          </p>
        </div>

        <div className="p-3 space-y-2.5 overflow-y-auto max-h-[540px]">
          {zones.map((z) => {
            const draft = getDraft(z);
            return (
              <div
                key={z.id}
                className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white">{z.nombre}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-cyan-300 uppercase font-semibold">
                    {z.tipo}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-1">
                      <Gauge className="w-3 h-3 text-cyan-400" />
                      Límite velocidad (km/h)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={25}
                      value={draft.speed}
                      onChange={(e) =>
                        setDraftField(z, { speed: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Tarifa (COP / min)
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={10000}
                      step={50}
                      value={draft.rate}
                      onChange={(e) =>
                        setDraftField(z, { rate: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.applyAll}
                      onChange={(e) =>
                        setDraftField(z, { applyAll: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                    />
                    <span>Aplicar tarifa a todas las zonas</span>
                  </label>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      onSaveZone(z.id, {
                        limite_velocidad: draft.speed,
                        tarifa_minuto: draft.rate,
                        applyRateToAllZones: draft.applyAll,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

