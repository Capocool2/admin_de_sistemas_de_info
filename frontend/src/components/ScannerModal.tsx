// frontend/src/components/ScannerModal.tsx

import React, { useState } from 'react';
import { QrCode, X, Zap, AlertCircle, Loader2, RotateCcw } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (scooterId: string, forzarCierreAnterior?: boolean) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onUnlock,
  isLoading,
  errorMessage,
}) => {
  const [scooterId, setScooterId] = useState('SCOOTER-01');

  if (!isOpen) return null;

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
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Simulation Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-48 h-48 mb-4 border-2 border-dashed border-emerald-500/70 rounded-xl flex items-center justify-center bg-slate-950 overflow-hidden">
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-80" />
            <div className="text-center p-4">
              <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-slate-400">Apunte la cámara al código QR físico del manubrio</p>
            </div>
          </div>

          {/* Form manual input */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                O escribe el identificador del monopatín:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scooterId}
                  onChange={(e) => setScooterId(e.target.value.toUpperCase())}
                  placeholder="Ej: SCOOTER-01"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
            </div>

            {/* Quick buttons de selección rápida de la flota */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['SCOOTER-01', 'SCOOTER-02', 'SCOOTER-03', 'SCOOTER-04', 'SCOOTER-05'].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScooterId(id)}
                  className={`text-[11px] px-2 py-1 rounded border font-mono transition ${
                    scooterId === id
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                      : id === 'SCOOTER-05'
                      ? 'border-amber-700/60 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30'
                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {id} {id === 'SCOOTER-05' ? '⚠️' : ''}
                </button>
              ))}
            </div>

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
              disabled={isLoading || !scooterId}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Conectando con el candado...</span>
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
