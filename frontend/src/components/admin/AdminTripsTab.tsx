// frontend/src/components/admin/AdminTripsTab.tsx
import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';
import { AdminSummary, AdminTripRecord } from '../../types';

interface AdminTripsTabProps {
  trips: AdminTripRecord[];
  summary: AdminSummary | null;
  onRefresh: () => void;
}

export const AdminTripsTab: React.FC<AdminTripsTabProps> = ({
  trips,
  summary,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'finalizado' | 'cancelado'>('all');
  const [search, setSearch] = useState('');
  const [photoTrip, setPhotoTrip] = useState<AdminTripRecord | null>(null);

  const filtered = trips.filter((t) => {
    if (statusFilter !== 'all' && t.estado !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.monopatin_id.toLowerCase().includes(q) ||
      (t.usuario?.nombre_completo || '').toLowerCase().includes(q) ||
      (t.usuario?.correo || '').toLowerCase().includes(q)
    );
  });

  const formatCOP = (val: string | number | null | undefined) => {
    const num = Number(val) || 0;
    return `$${num.toLocaleString('es-CO')} COP`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950">
      {/* KPIs Financieros y Operativos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
            <DollarSign className="w-4 h-4" />
            <span>Ingresos Totales</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {formatCOP(summary?.ingresos_totales ?? 0)}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-cyan-400 text-xs mb-1">
            <Clock className="w-4 h-4" />
            <span>Viajes Registrados</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {summary?.total_viajes ?? trips.length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-emerald-300 text-xs mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Finalizados</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {summary?.viajes_finalizados ??
              trips.filter((t) => t.estado === 'finalizado').length}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-amber-400 text-xs mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Multas por Abandono</span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {summary?.multas_aplicadas ?? 0}
          </div>
        </div>
      </div>

      {/* Filtros y buscador */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'activo', 'finalizado', 'cancelado'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                statusFilter === st
                  ? 'bg-cyan-600 text-white border-cyan-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {st === 'all' ? 'Todos' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar turista o SCOOTER..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla de viajes */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
            <tr>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Turista</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Duración</th>
              <th className="px-4 py-3">Cobro</th>
              <th className="px-4 py-3">Evidencia Parqueo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay viajes que coincidan con el filtro actual
                </td>
              </tr>
            ) : (
              filtered.map((trip) => {
                const ref = trip.pagos?.[0]?.referencia_transaccion || '';
                const hasPenalty =
                  ref.startsWith('PAY-PENALTY') || ref.startsWith('PAY-ABANDON');

                return (
                  <tr key={trip.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {new Date(trip.inicio_viaje).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {trip.usuario?.nombre_completo || 'Turista'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {trip.usuario?.correo || trip.usuario_id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-cyan-300">
                      {trip.monopatin_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          trip.estado === 'activo'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : trip.estado === 'finalizado'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {trip.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {trip.duracion_minutos ? `${trip.duracion_minutos} min` : 'En curso'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <div className="font-bold text-white">
                        {trip.costo_total ? formatCOP(trip.costo_total) : '—'}
                      </div>
                      {hasPenalty && (
                        <span className="text-[9px] text-amber-400 font-sans font-semibold">
                          Incluye multa abandono
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {trip.foto_evidencia_url ? (
                        <button
                          type="button"
                          onClick={() => setPhotoTrip(trip)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Ver evidencia</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">Sin foto</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Evidencia de Parqueo */}
      {photoTrip && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">
                  Evidencia de Parqueo • {photoTrip.monopatin_id}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Turista: {photoTrip.usuario?.nombre_completo || 'Usuario SAME'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoTrip(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {photoTrip.foto_evidencia_url?.startsWith('data:image') ||
            photoTrip.foto_evidencia_url?.startsWith('http') ? (
              <img
                src={photoTrip.foto_evidencia_url}
                alt={`Evidencia ${photoTrip.monopatin_id}`}
                className="w-full max-h-64 object-cover rounded-xl border border-slate-700"
              />
            ) : (
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 font-mono break-all">
                Referencia de evidencia registrada: {photoTrip.foto_evidencia_url}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

