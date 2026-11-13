// frontend/src/components/EndTripModal.tsx

import React, { useState } from 'react';
import { Camera, X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface EndTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmEnd: (fotoUrl: string, forzarAbandono?: boolean) => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
  scooterId: string;
}

export const EndTripModal: React.FC<EndTripModalProps> = ({
  isOpen,
  onClose,
  onConfirmEnd,
  isLoading,
  errorMessage,
  scooterId,
}) => {
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=500&q=80'
  );
  const [useCustomPhoto, setUseCustomPhoto] = useState(false);

  if (!isOpen) return null;

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setUseCustomPhoto(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = () => {
    const finalPhoto =
      photoPreview || 'https://storage.same.com.co/evidencias/foto-parqueo-malecon.jpg';
    onConfirmEnd(finalPhoto, false);
  };

  const handleAbandonOutsideZone = () => {
    const finalPhoto =
      photoPreview || 'https://storage.same.com.co/evidencias/foto-parqueo-malecon.jpg';
    onConfirmEnd(finalPhoto, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm overflow-hidden bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <Camera className="w-5 h-5" />
            <span>Evidencia de Parqueo ({scooterId})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center">
          <p className="text-xs text-slate-300 text-center mb-3">
            Para finalizar tu viaje, debes estacionar en una{' '}
            <strong className="text-emerald-400">Estación de Parqueo Autorizado</strong> y capturar
            una foto que demuestre que el monopatín quedó de pie sin obstruir el paso peatonal.
          </p>

          {/* Photo Preview Frame */}
          <div className="relative w-full h-44 mb-3 border-2 border-slate-700 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Evidencia parqueo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <Camera className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <span className="text-xs text-slate-400">Toma una foto del monopatín</span>
              </div>
            )}

            {/* Input file overlay */}
            <label className="absolute bottom-2 right-2 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-slate-600 flex items-center gap-1.5 backdrop-blur-sm transition">
              <Camera className="w-3.5 h-3.5" />
              <span>{useCustomPhoto ? 'Cambiar foto' : 'Tomar foto en vivo'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
              />
            </label>
          </div>

          {/* Error Message if outside parking geofence */}
          {errorMessage && (
            <div className="w-full mb-3 space-y-2">
              <div className="p-3 text-xs text-rose-300 bg-rose-950/70 border border-rose-800 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <p className="font-semibold text-rose-200">Parqueo No Autorizado</p>
                  <p className="text-[11px] mt-0.5 text-rose-300/90 leading-tight">
                    {errorMessage}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAbandonOutsideZone}
                disabled={isLoading}
                className="w-full py-2.5 px-3 bg-amber-700/90 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition border border-amber-500/40"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Dejar aquí de todos modos (Multa +$15,000 COP)</span>
              </button>
            </div>
          )}

          {/* Confirm Button */}
          <button
            onClick={handleFinish}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Validando geocerca PostGIS...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Validar Parqueo y Bloquear Candado</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

