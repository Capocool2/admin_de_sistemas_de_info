// frontend/src/views/VerifyEmail.tsx
import React, { useState } from 'react';
import {
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Info,
} from 'lucide-react';
import { verifyEmail, resendVerificationCode } from '../services/api';

interface VerifyEmailProps {
  initialEmail?: string;
  onVerificationSuccess: (correo: string) => void;
  onNavigateToLogin: () => void;
}

export const VerifyEmail: React.FC<VerifyEmailProps> = ({
  initialEmail = '',
  onVerificationSuccess,
  onNavigateToLogin,
}) => {
  const [correo, setCorreo] = useState(initialEmail);
  const [codigo, setCodigo] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = correo.trim().toLowerCase();
    const cleanCode = codigo.trim();

    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo electrónico.');
      return;
    }

    if (cleanCode.length !== 6) {
      setErrorMsg('El código de verificación debe tener exactamente 6 dígitos.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await verifyEmail(cleanEmail, cleanCode);
      setIsVerified(true);
      setSuccessMsg(res.message || 'Correo verificado correctamente. Ahora puedes iniciar sesión.');

      // Tras 2 segundos de confirmación visual, redirigir obligatoriamente al Login
      window.setTimeout(() => {
        onVerificationSuccess(cleanEmail);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Código de verificación incorrecto o expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const cleanEmail = correo.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo para reenviar el código.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsResending(true);

    try {
      const res = await resendVerificationCode(cleanEmail);
      setSuccessMsg(res.message || 'Nuevo código de verificación enviado a tu correo.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reenviar el código.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden z-10">
        {/* Cabecera */}
        <div className="p-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-800/40 to-transparent">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold text-2xl mx-auto mb-3 shadow-lg shadow-cyan-950/50">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            SAME <span className="text-cyan-400 font-light text-base">| Verificación</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Valida tu correo electrónico con el código OTP de 6 dígitos
          </p>
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-950/70 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-start gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Fallback info para pruebas locales */}
        <div className="mx-6 mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>Pruebas locales:</strong> Si no tienes SMTP configurado en el archivo <code className="text-cyan-300">.env</code>, el código se imprime automáticamente en la consola de la terminal del backend.
          </span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleVerify} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="turista@ejemplo.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Código de Verificación (6 dígitos)
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 123456"
                className="w-full pl-9 pr-3 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-base tracking-[0.4em] font-mono font-bold text-center text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              El código numérico tiene una vigencia de 15 minutos.
            </p>
          </div>

          {/* Botón Principal: Verificar Correo */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading || isVerified}
              className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-950/60 flex items-center justify-center gap-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando código en Neon...</span>
                </>
              ) : isVerified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>¡Verificado! Redirigiendo a Login...</span>
                </>
              ) : (
                <>
                  <span>Verificar Correo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Botón Secundario: Reenviar Código */}
            <button
              type="button"
              disabled={isResending || isVerified}
              onClick={handleResend}
              className="w-full py-2.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              <span>{isResending ? 'Reenviando nuevo código...' : 'Reenviar código'}</span>
            </button>
          </div>
        </form>

        {/* Pie con enlace directo a Login */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            ¿Ya verificaste tu código?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline ml-1"
            >
              Ir a Iniciar Sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
