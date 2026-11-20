// frontend/src/views/Login.tsx
import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  UserPlus,
  ShieldAlert,
} from 'lucide-react';
import { login } from '../services/api';
import { AuthUser } from '../types';

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  onNavigateToRegister: () => void;
  onNavigateToVerify: (correo?: string) => void;
  prefilledEmail?: string;
  initialSuccessMessage?: string | null;
}

export const Login: React.FC<LoginProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateToVerify,
  prefilledEmail = '',
  initialSuccessMessage = null,
}) => {
  const [loginEmail, setLoginEmail] = useState(prefilledEmail);
  const [loginPassword, setLoginPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnverifiedError, setIsUnverifiedError] = useState(false);
  const [isBannedError, setIsBannedError] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(initialSuccessMessage);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUnverifiedError(false);
    setIsBannedError(false);
    setIsLoading(true);

    try {
      const cleanEmail = loginEmail.trim().toLowerCase();
      const res = await login(cleanEmail, loginPassword);
      onLoginSuccess(res.user);
    } catch (err: any) {
      const msg: string = err.message || 'Error al iniciar sesión';
      setErrorMsg(msg);

      if (msg.toLowerCase().includes('validar tu correo') || msg.toLowerCase().includes('verificar tu correo')) {
        setIsUnverifiedError(true);
      } else if (msg.toLowerCase().includes('dada de baja') || msg.toLowerCase().includes('salidas del área')) {
        setIsBannedError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Fondo con resplandor ambiental */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden z-10">
        {/* Cabecera / Marca SAME */}
        <div className="p-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-800/40 to-transparent">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-2xl mx-auto mb-3 shadow-lg shadow-emerald-950/50">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            SAME <span className="text-emerald-400 font-light text-base">| Malecón</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sistema de Alquiler de Monopatines Eléctricos • Barranquilla
          </p>
        </div>

        {/* Mensaje de Éxito Previo (ej. tras validar correo) */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/80 border border-emerald-700 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mensaje de Error Normal */}
        {errorMsg && !isBannedError && !isUnverifiedError && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Banner Crítico: Correo no verificado */}
        {isUnverifiedError && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-950/80 border border-amber-600 rounded-2xl text-xs text-amber-200 animate-fadeIn space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMsg}</div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToVerify(loginEmail)}
              className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <span>Validar mi correo con código OTP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Banner Crítico: Cuenta dada de baja por 3 strikes */}
        {isBannedError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/90 border border-rose-600 rounded-2xl text-xs text-rose-200 animate-fadeIn space-y-1.5 shadow-lg shadow-rose-950/80">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-rose-100 font-bold uppercase tracking-wider text-[11px]">
                  Cuenta Inhabilitada Definitivamente
                </strong>
                <p className="mt-0.5 text-rose-200">{errorMsg}</p>
              </div>
            </div>
            <p className="text-[10px] text-rose-400 border-t border-rose-800/80 pt-1.5">
              Por razones de seguridad operacional, los usuarios con 3 infracciones de perímetro no pueden volver a iniciar sesión ni alquilar unidades.
            </p>
          </div>
        )}

        {/* Formulario de Login */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="usuario@same.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <>
                <span>Ingresar a la Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Sección Crear Cuenta Turista */}
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="w-full py-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>¿Nuevo turista? Crear Cuenta con Verificación</span>
          </button>
        </div>
      </div>
    </div>
  );
};
