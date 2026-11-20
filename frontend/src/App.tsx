// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { Smartphone, LayoutDashboard, LogOut } from 'lucide-react';
import { UserMap } from './views/UserMap';
import { AdminDashboard } from './views/AdminDashboard';
import { Login } from './views/Login';
import { Register } from './views/Register';
import { VerifyEmail } from './views/VerifyEmail';
import { getStoredUser, logout } from './services/api';
import { AuthUser } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [adminActiveTab, setAdminActiveTab] = useState<'dashboard' | 'tourist_preview'>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register' | 'verify'>('login');
  const [emailToVerify, setEmailToVerify] = useState<string>('');
  const [loginSuccessNotice, setLoginSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    // Sincronizar usuario guardado en localStorage
    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setAdminActiveTab('dashboard');
    setAuthView('login');
    setLoginSuccessNotice(null);
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setAdminActiveTab('dashboard');
    setAuthView('login');
    setLoginSuccessNotice(null);
  };

  // 1. Control de vistas para usuarios no autenticados
  if (!currentUser) {
    if (authView === 'register') {
      return (
        <Register
          onRegisterSuccess={(correo) => {
            setEmailToVerify(correo);
            setAuthView('verify');
          }}
          onNavigateToLogin={() => setAuthView('login')}
        />
      );
    }

    if (authView === 'verify') {
      return (
        <VerifyEmail
          initialEmail={emailToVerify}
          onVerificationSuccess={(correo) => {
            setEmailToVerify(correo);
            setLoginSuccessNotice('Correo verificado exitosamente. Ahora ingresa tus credenciales para acceder.');
            setAuthView('login');
          }}
          onNavigateToLogin={() => setAuthView('login')}
        />
      );
    }

    return (
      <Login
        prefilledEmail={emailToVerify}
        initialSuccessMessage={loginSuccessNotice}
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setAuthView('register')}
        onNavigateToVerify={(email) => {
          if (email) setEmailToVerify(email);
          setAuthView('verify');
        }}
      />
    );
  }

  // 2. Control de Acceso Basado en Roles (RBAC):
  // Si el usuario es TURISTA:
  // - NUNCA tiene acceso a la vista de Administrador.
  // - Es confinado exclusivamente al mapa móvil de alquiler.
  if (currentUser.rol === 'turista') {
    return (
      <div className="relative w-screen h-screen flex flex-col bg-slate-950 font-sans">
        <UserMap currentUser={currentUser} onLogout={handleLogout} />
      </div>
    );
  }

  // 3. Si el usuario es ADMINISTRADOR:
  // - Carga por defecto la Torre de Control (Admin Dashboard).
  // - Cuenta con barra de inspección técnica para auditar la app de turista si lo requiere.
  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-950 font-sans">
      {/* Barra de Gestión Exclusiva para Administradores */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-cyan-400">Modo Administrador:</span>
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setAdminActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                adminActiveTab === 'dashboard'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Torre de Control</span>
            </button>
            <button
              onClick={() => setAdminActiveTab('tourist_preview')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                adminActiveTab === 'tourist_preview'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Inspección Turista</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 hidden sm:inline">
            Admin: <strong className="text-white">{currentUser.nombre_completo}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Área Principal */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {adminActiveTab === 'dashboard' ? (
          <AdminDashboard currentUser={currentUser} onLogout={handleLogout} />
        ) : (
          <UserMap currentUser={currentUser} onLogout={handleLogout} />
        )}
      </div>
    </div>
  );
}

export default App;
