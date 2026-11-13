// frontend/src/views/Login.tsx
import React, { useState } from 'react';
import {
  Zap,
  Lock,
  Mail,
  User,
  Phone,
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { login, registerTourist } from '../services/api';
import { AuthUser } from '../types';

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Estados Formulario Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Estados Formulario Registro Turista
  const [regName, setRegName] = useState('');
  const [regDoc, setRegDoc] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Estados UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manejo de Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await login(loginEmail, loginPassword);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  // Manejo de Registro
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await registerTourist({
        nombre_completo: regName,
        documento_identidad: regDoc,
        correo: regEmail,
        telefono: regPhone,
        password: regPassword,
      });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  // Accesos Rápidos de Prueba (Demo)
  const setDemoCredentials = (type: 'admin' | 'turista') => {
    setErrorMsg(null);
    setActiveTab('login');
    if (type === 'admin') {
      setLoginEmail('admin@same.com');
      setLoginPassword('Admin2026*');
    } else {
      setLoginEmail('test@same.com');
      setLoginPassword('Turista123*');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 relative overflow-hidden">
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

        {/* Selector de Pestañas: Login vs Registro */}
        <div className="flex p-1 m-4 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'register'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Crear Cuenta (Turista)</span>
          </button>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mx-6 mb-3 p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario 1: Iniciar Sesión */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="p-6 pt-2 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Correo Electrónico</span>
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="ej: usuario@same.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Contraseña</span>
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Entrar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Accesos de Prueba Rápidos */}
            <div className="pt-4 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400 block text-center mb-2 font-semibold uppercase tracking-wider">
                ⚡ Credenciales Oficiales de Demostración
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('turista')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 border border-slate-700 transition flex items-center justify-center gap-1"
                >
                  <span>🚲 Turista (Test)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin')}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 text-[11px] text-cyan-300 border border-cyan-800/70 transition flex items-center justify-center gap-1 font-semibold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin (Torre)</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Formulario 2: Crear Cuenta Turista */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="p-6 pt-2 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Nombre Completo</span>
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="ej: Juan Camilo Pérez"
                className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Documento</span>
                </label>
                <input
                  type="text"
                  required
                  value={regDoc}
                  onChange={(e) => setRegDoc(e.target.value)}
                  placeholder="CC-1045..."
                  className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Teléfono</span>
                </label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+57300..."
                  className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Correo Electrónico</span>
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="juan.perez@correo.com"
                className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Contraseña (Mínimo 6 caracteres)</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div className="pt-2">
              <span className="text-[10px] text-slate-400 block mb-2 leading-tight">
                ℹ️ Las cuentas creadas públicamente se registran de forma obligatoria con el rol{' '}
                <strong className="text-emerald-400">Turista</strong>.
              </span>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando tu cuenta...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Registrarse y Empezar a Rodar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

