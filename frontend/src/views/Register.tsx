// frontend/src/views/Register.tsx
import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  FileText,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { registerTourist } from '../services/api';

interface RegisterProps {
  onRegisterSuccess: (correo: string) => void;
  onNavigateToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [documentoIdentidad, setDocumentoIdentidad] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const cleanEmail = correo.trim().toLowerCase();
      await registerTourist({
        nombre_completo: nombreCompleto,
        documento_identidad: documentoIdentidad,
        correo: cleanEmail,
        telefono,
        password,
      });

      // Redirigir a la pantalla de verificación de correo pasando el email registrado
      onRegisterSuccess(cleanEmail);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Resplandor ambiental de fondo */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden z-10">
        {/* Cabecera SAME */}
        <div className="p-6 text-center border-b border-slate-800/80 bg-gradient-to-b from-slate-800/40 to-transparent">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-2xl mx-auto mb-3 shadow-lg shadow-emerald-950/50">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            SAME <span className="text-emerald-400 font-light text-base">| Registro</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Crea tu cuenta de Turista para recorrer el Gran Malecón
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario de Registro */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Nombre Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Sofía Gómez Morales"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Documento (CC / Pasaporte)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={documentoIdentidad}
                  onChange={(e) => setDocumentoIdentidad(e.target.value)}
                  placeholder="CC-1042999888"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Teléfono
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  required
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+573001234567"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico (Obligatorio para verificación)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="turista@ejemplo.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Te enviaremos un código numérico de 6 dígitos para activar tu cuenta.
            </p>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando código de verificación...</span>
                </>
              ) : (
                <>
                  <span>Registrar y Recibir Código</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Pie con enlace a Login */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            ¿Ya tienes una cuenta?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline ml-1"
            >
              Inicia Sesión aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
