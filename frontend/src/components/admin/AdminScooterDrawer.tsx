// frontend/src/components/admin/AdminScooterDrawer.tsx
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Clock,
  Crosshair,
  MapPin,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  Truck,
  Unlock,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { AdminFleetUnit } from '../../types';

interface AdminScooterDrawerProps {
  unit: AdminFleetUnit;
  isFollowing: boolean;
  isBusy: boolean;
  onClose: () => void;
  onToggleFollow: (scooterId: string) => void;
  onRelocate: (scooterId: string, stationId: 'P1' | 'P2' | 'P3') => Promise<void>;
  onDispatchRecovery: (scooterId: string, stationId?: 'P1' | 'P2' | 'P3') => Promise<void>;
  onScheduleFreeEnd: (scooterId: string, reason?: string) => Promise<void>;
  onChangeStatus: (
    scooterId: string,
    estado: 'disponible' | 'mantenimiento',
    deferIfInUse?: boolean,
  ) => Promise<void>;
  onClearLock: (scooterId: string) => Promise<void>;
  onSendNotice: (scooterId: string, message: string) => Promise<void>;
  onForceCancelBlockedTrip: (viajeId: string, scooterId: string) => Promise<void>;
}

const QUICK_NOTICES = [
  'Por favor retorna a la ciclorruta autorizada del Gran Malecón.',
  'Tu batería está por debajo del 20%. Acércate a la estación más cercana.',
  'Estás en zona peatonal: mantén velocidad prudente (máx 10 km/h).',
];

export const AdminScooterDrawer: React.FC<AdminScooterDrawerProps> = ({
  unit,
  isFollowing,
  isBusy,
  onClose,
  onToggleFollow,
  onRelocate,
  onDispatchRecovery,
  onScheduleFreeEnd,
  onChangeStatus,
  onClearLock,
  onSendNotice,
  onForceCancelBlockedTrip,
}) => {
  const [noticeText, setNoticeText] = useState('');
  const [recallReasonText, setRecallReasonText] = useState('');
  const [recallRemainingSec, setRecallRemainingSec] = useState(0);

  const hasActiveTrip = Boolean(unit.activeTripId);
  const isBlocked = unit.estado === 'bloqueado';
  const isMaintenance = unit.estado === 'mantenimiento';
  const isInUse = unit.estado === 'en uso';
  const isLostOrOutsideParking =
    Boolean(unit.outOfPerimeter) || isBlocked || unit.isInsideParkingZone === false;

  useEffect(() => {
    if (!unit.recallDeadlineAt) {
      setRecallRemainingSec(0);
      return;
    }
    const deadlineMs = new Date(unit.recallDeadlineAt).getTime();
    const updateSec = () => {
      setRecallRemainingSec(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    };
    updateSec();
    const interval = setInterval(updateSec, 1000);
    return () => clearInterval(interval);
  }, [unit.recallDeadlineAt]);

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeText.trim()) return;
    await onSendNotice(unit.scooterId, noticeText.trim());
    setNoticeText('');
  };

  return (
    <div className="mx-2.5 my-2 p-3 rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-xl space-y-2.5 text-xs">
      {/* Header de unidad */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-sm text-white">{unit.scooterId}</span>
            {unit.outOfPerimeter && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-600 text-white">
                FUERA DE PERÍMETRO
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>{unit.zoneName}</span>
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleFollow(unit.scooterId)}
            title={isFollowing ? 'Dejar de seguir' : 'Seguir unidad en el mapa'}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 border transition ${
              isFollowing
                ? 'bg-cyan-600 text-white border-cyan-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Crosshair className="w-3 h-3" />
            <span>{isFollowing ? 'Siguiendo' : 'Seguir'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Telemetría condensada */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block">Estado BD</span>
          <span className="font-bold text-slate-100 uppercase">{unit.estado}</span>
        </div>
        <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block">Velocidad</span>
          <span className="font-mono font-bold text-cyan-300">{unit.speed} km/h</span>
        </div>
        <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <span className="text-[10px] text-slate-400 block">Batería</span>
          <span
            className={`font-mono font-bold ${
              unit.battery < 15
                ? 'text-rose-400'
                : unit.battery < 20
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {unit.battery}%
          </span>
        </div>
      </div>

      {/* Info de turista activo */}
      {hasActiveTrip && (
        <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-200 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-semibold">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              {unit.activeRiderName || 'Turista en curso'}
            </span>
            {unit.activeTripStart && (
              <span className="text-[10px] text-cyan-400 font-mono">
                Desde {new Date(unit.activeTripStart).toLocaleTimeString()}
              </span>
            )}
          </div>
          {isInUse && !unit.outOfPerimeter && (
            <p className="text-[10px] text-slate-300 leading-snug">
              Protección al turista activa: no se permite cortar energía ni recolocar mientras circula en zona autorizada.
            </p>
          )}
        </div>
      )}

      {/* Acciones cuando tiene viaje activo normal */}
      {hasActiveTrip && !isBlocked && (
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <form onSubmit={handleNoticeSubmit} className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-cyan-400" />
              Enviar aviso preventivo al celular del turista
            </label>
            <div className="flex flex-wrap gap-1">
              {QUICK_NOTICES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onSendNotice(unit.scooterId, preset)}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] transition"
                >
                  {idx === 0 ? 'Volver a ruta' : idx === 1 ? 'Batería baja' : 'Límite 10 km/h'}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="Mensaje breve al turista..."
                maxLength={200}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isBusy || noticeText.trim().length < 3}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </form>

          <button
            type="button"
            disabled={isBusy || Boolean(unit.pendingMaintenance)}
            onClick={() => onChangeStatus(unit.scooterId, 'mantenimiento', true)}
            className="w-full py-1.5 px-3 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 disabled:opacity-50 text-amber-200 border border-amber-700/70 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>
              {unit.pendingMaintenance
                ? 'Mantenimiento programado al finalizar viaje'
                : 'Programar mantenimiento al terminar viaje'}
            </span>
          </button>

          {/* Medida de seguridad: finalizar en 5 minutos sin cobro para revisar monopatín */}
          <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-700/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1 uppercase tracking-wide">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Revisión urgente (Fin 5 min gratis)
              </span>
              {unit.recallDeadlineAt && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-extrabold">
                  {formatCountdown(recallRemainingSec)}
                </span>
              )}
            </div>

            {unit.recallDeadlineAt ? (
              <p className="text-[11px] text-amber-200 leading-snug">
                Turista notificado. El viaje finalizará automáticamente en{' '}
                <strong>{formatCountdown(recallRemainingSec)}</strong> sin cobro ($0 COP) y pasará a mantenimiento.
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={recallReasonText}
                  onChange={(e) => setRecallReasonText(e.target.value)}
                  placeholder="Motivo (ej: Revisión preventiva de frenos)"
                  maxLength={180}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    onScheduleFreeEnd(
                      unit.scooterId,
                      recallReasonText.trim() || undefined,
                    );
                    setRecallReasonText('');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Avisar y finalizar viaje en 5 min (Sin cobro)</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Acciones si quedó bloqueado CON viaje activo sin cerrar */}
      {hasActiveTrip && isBlocked && (
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          {!unit.outOfPerimeter && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onClearLock(unit.scooterId)}
              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Liberar alarma y permitir continuar</span>
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onForceCancelBlockedTrip(unit.activeTripId!, unit.scooterId)}
            className="w-full py-1.5 px-3 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-700 font-semibold text-[11px] flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cerrar viaje bloqueado (sin multa manual)</span>
          </button>
        </div>
      )}

      {/* Acciones operativas cuando NO hay viaje activo */}
      {!hasActiveTrip && (
        <div className="space-y-2 pt-1 border-t border-slate-800">
          {unit.recoveryInProgress ? (
            <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-indigo-200">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
                  En búsqueda hacia parqueo
                </span>
                <span className="font-mono text-indigo-300">{unit.recoveryProgress ?? 0}%</span>
              </div>
              <p className="text-[10px] text-indigo-200/90 truncate">
                Destino: {unit.recoveryStationName || 'Estación autorizada'}
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-400 transition-all duration-500"
                  style={{ width: `${unit.recoveryProgress ?? 0}%` }}
                />
              </div>
            </div>
          ) : isLostOrOutsideParking ? (
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-700/60 space-y-1.5">
              <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1 uppercase tracking-wide">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                Monopatín perdido / fuera de parqueo
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onDispatchRecovery(unit.scooterId)}
                className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Mandar buscar al parqueo más cercano</span>
              </button>
              <div className="grid grid-cols-3 gap-1">
                {(['P1', 'P2', 'P3'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isBusy}
                    onClick={() => onDispatchRecovery(unit.scooterId, st)}
                    className="py-1 px-1.5 rounded-md bg-slate-800/90 hover:bg-indigo-700 text-indigo-200 border border-indigo-800/70 text-[10px] font-semibold transition"
                  >
                    Buscar → {st}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1 mb-1">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              Recolocar logísticamente y recargar (100%)
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['P1', 'P2', 'P3'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onRelocate(unit.scooterId, st)}
                  className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-emerald-700/80 hover:text-white text-slate-200 border border-slate-700 text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{st === 'P1' ? 'P1 Oro' : st === 'P2' ? 'P2 Caimán' : 'P3 Manglar'}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {isBlocked && !unit.outOfPerimeter && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onClearLock(unit.scooterId)}
                className="col-span-2 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Liberar bloqueo / alarma</span>
              </button>
            )}

            {!isMaintenance ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onChangeStatus(unit.scooterId, 'mantenimiento', false)}
                className="col-span-2 py-1.5 px-3 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Enviar a Mantenimiento</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy || unit.battery < 20 || unit.outOfPerimeter}
                title={
                  unit.battery < 20
                    ? 'Requiere al menos 20% de batería (usa Recolocar y Recargar)'
                    : unit.outOfPerimeter
                    ? 'Debes recolocarla dentro del Gran Malecón'
                    : 'Habilitar unidad para turistas'
                }
                onClick={() => onChangeStatus(unit.scooterId, 'disponible', false)}
                className="col-span-2 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {unit.battery < 20
                    ? 'Batería <20% (Usa Recolocar 100%)'
                    : 'Reactivar a Disponible'}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

