// frontend/src/components/ReceiptModal.tsx

import React from 'react';
import { CheckCircle2, Receipt, Clock, DollarSign, MapPin, Hash, Sparkles } from 'lucide-react';
import { TripReceipt } from '../types';

interface ReceiptModalProps {
  receipt: TripReceipt | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm overflow-hidden bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl">
        {/* Top Celebration Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-center text-white relative">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-sm shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold">¡Viaje Finalizado!</h3>
          <p className="text-emerald-100 text-xs mt-0.5">
            Monopatín {receipt.scooterId} bloqueado exitosamente
          </p>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          {/* Total Cost Display */}
          <div className="text-center py-2 border-b border-slate-800">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Total Cobrado
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-0.5">
              ${receipt.costoTotalCOP.toLocaleString('es-CO')}{' '}
              <span className="text-sm font-normal text-slate-400">COP</span>
            </div>
            <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              Transacción Aprobada (Sandbox)
            </span>
          </div>

          {/* Details breakdown */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tiempo de uso:</span>
              </span>
              <span className="font-semibold text-white">
                {receipt.duracionMinutos} {receipt.duracionMinutos === 1 ? 'minuto' : 'minutos'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tarifa por minuto:</span>
              </span>
              <span className="font-semibold text-white">
                ${receipt.tarifaMinutoCOP.toLocaleString('es-CO')} COP
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Estación de Parqueo:</span>
              </span>
              <span className="font-semibold text-white truncate max-w-[160px]">
                {receipt.estacionParqueo}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>ID Transacción:</span>
              </span>
              <span className="font-mono text-[10px] text-slate-300">
                {receipt.pago?.referencia || 'PAY-SAME-OK'}
              </span>
            </div>
          </div>

          {/* Environmental badge */}
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-center gap-2 text-[11px] text-emerald-300">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>¡Gracias por moverte de forma sostenible en el Gran Malecón!</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition"
          >
            Aceptar y Volver al Mapa
          </button>
        </div>
      </div>
    </div>
  );
};

