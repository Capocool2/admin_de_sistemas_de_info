// frontend/src/components/ScannerModal.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  QrCode,
  X,
  Zap,
  AlertCircle,
  Loader2,
  RotateCcw,
  Wrench,
  Lock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { FleetQuickStatus } from '../types';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (scooterId: string, forzarCierreAnterior?: boolean) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError?: () => void;
  fleetStatuses?: Record<string, FleetQuickStatus>;
  onRefreshFleet?: () => Promise<void> | void;
}

const FALLBACK_SCOOTER_IDS = [
  'SCOOTER-01',
  'SCOOTER-02',
  'SCOOTER-03',
  'SCOOTER-04',
  'SCOOTER-05',
];

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onUnlock,
  isLoading,
  errorMessage,
  onClearError,
  fleetStatuses = {},
  onRefreshFleet,
}) => {
  const [scooterId, setScooterId] = useState('SCOOTER-01');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasManualSelectionRef = useRef(false);

  const fleetIds =
    Object.keys(fleetStatuses).length > 0
      ? Object.keys(fleetStatuses).sort()
      : FALLBACK_SCOOTER_IDS;

  // Al abrir el modal (y cuando llegue la flota fresca), escoger el primer monopatín disponible si el usuario aún no eligió manualmente
  useEffect(() => {
    if (!isOpen) {
      hasManualSelectionRef.current = false;
      return;
    }
    if (hasManualSelectionRef.current) return;

    const current = fleetStatuses[scooterId];
    const currentAvailable =
      current && current.estado === 'disponible' && current.battery >= 20 && !current.outOfZone;
    if (!currentAvailable && Object.keys(fleetStatuses).length > 0) {
      const firstAvail = fleetIds.find((id) => {
        const st = fleetStatuses[id];
        return st && st.estado === 'disponible' && st.battery >= 20 && !st.outOfZone;
      });
      if (firstAvail) {
        setScooterId(firstAvail);
      }
    }
  }, [isOpen, fleetStatuses]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const selectedStatus = fleetStatuses[scooterId.trim().toUpperCase()];
  const isSelectedMaint = selectedStatus?.estado === 'mantenimiento';
  const isSelectedBlocked =
    selectedStatus?.estado === 'bloqueado' || Boolean(selectedStatus?.outOfZone);
  const isSelectedInUse = selectedStatus?.estado === 'en uso';
  const isSelectedLowBat =
    selectedStatus?.estado === 'disponible' && selectedStatus.battery < 20;
  const isSelectedUnavailable = Boolean(
    selectedStatus &&
      (isSelectedMaint || isSelectedBlocked || isSelectedInUse || isSelectedLowBat),
  );

  const handleSelectUnit = (id: string) => {
    hasManualSelectionRef.current = true;
    const normalized = id.toUpperCase();
    if (normalized !== scooterId && errorMessage) {
      onClearError?.();
    }
    setScooterId(normalized);
  };

  const submitButtonClass =
    isSelectedMaint || isSelectedLowBat
      ? 'bg-amber-950/70 border border-amber-700/70 text-amber-200 cursor-not-allowed'
      : isSelectedBlocked
      ? 'bg-rose-950/70 border border-rose-700/70 text-rose-200 cursor-not-allowed'
      : isSelectedInUse
      ? 'bg-cyan-950/70 border border-cyan-700/70 text-cyan-200 cursor-not-allowed'
      : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-950/40';

  const handleRefresh = async () => {
    if (!onRefreshFleet) return;
    setIsRefreshing(true);
    try {
      await onRefreshFleet();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scooterId.trim()) {
      onUnlock(scooterId.trim(), false);
    }
  };

  const handleForceUnlock = () => {
    if (scooterId.trim()) {
      onUnlock(scooterId.trim(), true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm overflow-hidden bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <QrCode className="w-5 h-5" />
            <span>Desbloquear Monopatín</span>
          </div>
          <div className="flex items-center gap-1">
            {onRefreshFleet && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Actualizar disponibilidad real"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Simulation Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-44 h-44 mb-4 border-2 border-dashed border-emerald-500/70 rounded-xl flex items-center justify-center bg-slate-950 overflow-hidden">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-80" />
            <div className="text-center p-4">
              <QrCode className="w-14 h-14 text-slate-600 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-slate-400">
                Apunte la cámara al código QR físico del manubrio
              </p>
            </div>
          </div>

          {/* Form manual input */}
          <form onSubmit={handleSubmit} className="w-full space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                O escribe el identificador del monopatín:
              </label>
              <input
                type="text"
                value={scooterId}
                onChange={(e) => handleSelectUnit(e.target.value)}
                placeholder="Ej: SCOOTER-01"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>

            {/* Botones de selección rápida con estado real en vivo */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {fleetIds.map((id) => {
                const st = fleetStatuses[id];
                const isSelected = scooterId === id;
                const isMaint = st?.estado === 'mantenimiento';
                const isBlocked = st?.estado === 'bloqueado' || Boolean(st?.outOfZone);
                const isInUse = st?.estado === 'en uso';
                const isLowBat = st?.estado === 'disponible' && st.battery < 20;

                let pillStyle =
                  'border-slate-700 text-slate-300 bg-slate-800/50 hover:bg-slate-800';
                let badgeText = st ? `${st.battery}%` : '';

                if (isSelected) {
                  if (isMaint || isLowBat) {
                    pillStyle =
                      'border-amber-500 bg-amber-500/20 text-amber-200 font-bold';
                  } else if (isBlocked) {
                    pillStyle = 'border-rose-500 bg-rose-500/20 text-rose-200 font-bold';
                  } else if (isInUse) {
                    pillStyle = 'border-cyan-500 bg-cyan-500/20 text-cyan-200 font-bold';
                  } else {
                    pillStyle =
                      'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold';
                  }
                } else if (isMaint || isLowBat) {
                  pillStyle =
                    'border-amber-700/60 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40';
                } else if (isBlocked) {
                  pillStyle =
                    'border-rose-700/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40';
                } else if (isInUse) {
                  pillStyle =
                    'border-cyan-700/60 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40';
                }

                if (isMaint) badgeText = '🔧 Mant.';
                else if (isBlocked) badgeText = '🔒 Bloq.';
                else if (isInUse) badgeText = 'En uso';
                else if (isLowBat) badgeText = `⚠️ ${st.battery}%`;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectUnit(id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition flex items-center gap-1.5 ${pillStyle}`}
                  >
                    <span>{id}</span>
                    {badgeText && (
                      <span className="text-[9px] font-sans opacity-90">{badgeText}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Estado real del monopatín seleccionado */}
            {selectedStatus && (
              <div
                className={`px-3 py-2 rounded-xl border text-[11px] flex items-center gap-2 ${
                  isSelectedMaint || isSelectedLowBat
                    ? 'bg-amber-950/50 border-amber-700/70 text-amber-200'
                    : isSelectedBlocked
                    ? 'bg-rose-950/50 border-rose-700/70 text-rose-200'
                    : isSelectedInUse
                    ? 'bg-cyan-950/50 border-cyan-700/70 text-cyan-200'
                    : 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                }`}
              >
                {isSelectedMaint ? (
                  <>
                    <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>En Mantenimiento:</strong> esta unidad está en revisión técnica. Elige otra disponible.
                    </span>
                  </>
                ) : isSelectedLowBat ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>Batería baja ({selectedStatus.battery}%):</strong> se requiere mínimo 20% para iniciar.
                    </span>
                  </>
                ) : isSelectedBlocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      <strong>Bloqueado:</strong> unidad bloqueada o fuera de zona hasta revisión operativa.
                    </span>
                  </>
                ) : isSelectedInUse ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      <strong>En ruta:</strong> otro turista está usando esta unidad actualmente.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Disponible</strong> • Batería {selectedStatus.battery}% • Listo para desbloquear.
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Mensajes de error y acción para forzar desbloqueo */}
            {errorMessage && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-3 text-xs text-rose-300 bg-rose-950/60 border border-rose-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>

                {errorMessage.toLowerCase().includes('viaje activo') && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleForceUnlock}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 shadow transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Forzar Cierre de Viaje Previo y Desbloquear</span>
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !scooterId.trim() || isSelectedUnavailable}
              className={`w-full py-3 px-4 font-medium rounded-xl flex items-center justify-center gap-2 transition ${submitButtonClass}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Conectando con el candado...</span>
                </>
              ) : isSelectedMaint ? (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>No disponible (En Mantenimiento)</span>
                </>
              ) : isSelectedBlocked ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>No disponible (Bloqueado)</span>
                </>
              ) : isSelectedInUse ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>En uso actualmente</span>
                </>
              ) : isSelectedLowBat ? (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>Batería insuficiente (&lt;20%)</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-current" />
                  <span>Desbloquear y Empezar Viaje</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
