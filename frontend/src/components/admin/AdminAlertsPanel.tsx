// frontend/src/components/admin/AdminAlertsPanel.tsx
import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { SecurityAlert } from '../../types';

interface AdminAlertsPanelProps {
  alerts: SecurityAlert[];
  pendingCount: number;
  onLocateAlert: (alert: SecurityAlert) => void;
  onAttendAlert: (alert: SecurityAlert) => Promise<void>;
}

export const AdminAlertsPanel: React.FC<AdminAlertsPanelProps> = ({
  alerts,
  pendingCount,
  onLocateAlert,
  onAttendAlert,
}) => {
  const [showAll, setShowAll] = useState(false);

  const visibleAlerts = showAll
    ? alerts
    : alerts.filter((a) => a.status !== 'atendida');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-t border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
        <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Alertas</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-full font-bold">
            {pendingCount}
          </span>
        </h3>

        <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-[10px]">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={`px-2 py-0.5 rounded-md font-semibold transition ${
              !showAll ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`px-2 py-0.5 rounded-md font-semibold transition ${
              showAll ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {visibleAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            {showAll
              ? 'No hay historial de alertas registrado'
              : 'Sin incidentes pendientes por atender'}
          </div>
        ) : (
          visibleAlerts.map((al) => {
            const isAttended = al.status === 'atendida';
            const isLowBat = al.type === 'bateria_baja';

            return (
              <div
                key={al.id}
                className={`p-2.5 rounded-xl border text-xs transition ${
                  isAttended
                    ? 'bg-slate-900/60 border-slate-800 opacity-65'
                    : isLowBat
                    ? 'bg-amber-950/35 border-amber-800/60'
                    : 'bg-rose-950/40 border-rose-800/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      isAttended
                        ? 'text-slate-400'
                        : isLowBat
                        ? 'text-amber-300'
                        : 'text-rose-300'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {al.scooterId} • {al.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {al.timestamp}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug mb-2">
                  {al.message}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onLocateAlert(al)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-semibold flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Ubicar</span>
                  </button>

                  {!isAttended ? (
                    <button
                      type="button"
                      onClick={() => onAttendAlert(al)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-[10px] font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Marcar atendida</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Atendida
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

