// frontend/src/App.tsx

import React, { useState } from 'react';
import { Smartphone, LayoutDashboard } from 'lucide-react';
import { UserMap } from './views/UserMap';
import { AdminDashboard } from './views/AdminDashboard';

export function App() {
  const [currentView, setCurrentView] = useState<'tourist' | 'admin'>('tourist');

  return (
    <div className="relative w-screen h-screen flex flex-col bg-slate-950 font-sans">
      {/* View Switcher Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Vista Activa:</span>
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setCurrentView('tourist')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                currentView === 'tourist'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Turista (Mobile App)</span>
            </button>
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                currentView === 'admin'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          Gran Malecón del Río • Barranquilla
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {currentView === 'tourist' ? <UserMap /> : <AdminDashboard />}
      </div>
    </div>
  );
}

export default App;

