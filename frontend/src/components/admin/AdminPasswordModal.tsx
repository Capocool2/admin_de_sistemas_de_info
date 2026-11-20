// frontend/src/components/admin/AdminPasswordModal.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, ShieldCheck, X } from 'lucide-react';

export interface AdminConfirmRequest {
  title: string;
  description: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: (adminPassword: string) => Promise<void>;
}

interface AdminPasswordModalProps {
  request: AdminConfirmRequest | null;
  onCancel: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  request,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setError(null);
    setIsSubmitting(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request, isSubmitting, onCancel]);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Debes ingresar tu contraseña de administrador para confirmar.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await request.onConfirm(password);
      onCancel();
    } catch (err: any) {
      setError(err?.message || 'No se pudo verificar la contraseña de administrador.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
    >
      <div
        className={`w-full max-w-md rounded-2xl bg-slate-900 border shadow-2xl overflow-hidden ${
          request.danger ? 'border-rose-600/70' : 'border-cyan-500/50'
        }`}
      >
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            request.danger
              ? 'bg-rose-950/60 border-rose-800/70'
              : 'bg-slate-800/70 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-5 h-5 ${request.danger ? 'text-rose-400' : 'text-cyan-400'}`}
            />
            <span className="text-sm font-bold text-white">
              Autorización de Administrador Requerida
            </span>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
              {request.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">{request.description}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Confirma tu contraseña de administrador</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ingresa tu contraseña..."
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-700/80 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition disabled:opacity-50 ${
                request.danger
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{request.confirmLabel || 'Confirmar cambio'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
