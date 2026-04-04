import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, CheckCircle2, XCircle, Clock, Loader2,
  User, Calendar, MessageSquare, Filter, RefreshCw,
  ChevronRight, AlertTriangle, Check, X, Inbox
} from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { getApiUrl, apiFetch } from '../../lib/api';

type LeaveRequest = {
  id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
  observaciones?: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  respuesta?: string;
  createdAt: string;
  requester: { nombre: string; turno: string; rol: string };
  reviewer?: { nombre: string } | null;
};

const TIPO_LABELS: Record<string, string> = {
  PERMISO: '📋 Permiso Personal',
  VACACIONES: '🌴 Vacaciones',
  AUSENCIA: '🏥 Ausencia Médica',
  OTRO: '📝 Otro',
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const estadoBadge = (estado: string) => {
  switch (estado) {
    case 'APROBADO':
      return { icon: <CheckCircle2 size={12} />, label: 'Aprobado', cls: 'bg-green-500/15 text-green-500 border-green-500/30' };
    case 'RECHAZADO':
      return { icon: <XCircle size={12} />, label: 'Rechazado', cls: 'bg-red-500/15 text-red-500 border-red-500/30' };
    default:
      return { icon: <Clock size={12} />, label: 'Pendiente', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' };
  }
};

export default function PermitsManagerPanel() {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'TODOS' | 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'>('PENDIENTE');
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [reviewError, setReviewError] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch(getApiUrl('/api/requests'));
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[PermitsManager] Error fetching:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
    const interval = setInterval(fetchRequests, 20000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleReview = async (estado: 'APROBADO' | 'RECHAZADO') => {
    if (!selected) return;
    setReviewError('');
    if (!responseText.trim()) {
      setReviewError('Por favor escribe una respuesta para el operario');
      return;
    }
    setIsReviewing(true);
    try {
      const res = await apiFetch(getApiUrl(`/api/requests/${selected.id}/review`), {
        method: 'PATCH',
        body: JSON.stringify({ estado, respuesta: responseText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        setReviewError(err.error || 'Error al procesar la revisión');
        return;
      }
      const updated = await res.json();
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelected(updated);
      setResponseText('');
    } catch {
      setReviewError('Error de conexión');
    } finally {
      setIsReviewing(false);
    }
  };

  const filtered = requests.filter(r =>
    filterStatus === 'TODOS' ? true : r.estado === filterStatus
  );

  const pendingCount = requests.filter(r => r.estado === 'PENDIENTE').length;

  const cardBase = `rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
    isDark ? 'border-white/8 hover:border-brand-primary/40' : 'border-gray-100 shadow-sm hover:border-brand-primary/30 hover:shadow-md'
  }`;

  return (
    <div className={`flex flex-col gap-0 h-full overflow-hidden ${isDark ? '' : ''}`}>
      {/* Header */}
      <div className={`px-6 py-5 border-b shrink-0 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-brand-primary/15 border border-brand-primary/30' : 'bg-brand-primary/10'}`}>
              <ClipboardList size={20} className="text-brand-primary" />
            </div>
            <div>
              <h2 className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Solicitudes y Permisos
              </h2>
              <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                {pendingCount > 0
                  ? `${pendingCount} solicitud${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''} de revisión`
                  : 'Todas las solicitudes revisadas'}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchRequests()}
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${
              isDark ? 'border-white/10 bg-white/5 text-white/40' : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Total', val: requests.length, color: isDark ? 'text-white' : 'text-gray-800', filter: 'TODOS' },
            { label: 'Pendientes', val: requests.filter(r => r.estado === 'PENDIENTE').length, color: 'text-amber-500', filter: 'PENDIENTE' },
            { label: 'Aprobadas', val: requests.filter(r => r.estado === 'APROBADO').length, color: 'text-green-500', filter: 'APROBADO' },
            { label: 'Rechazadas', val: requests.filter(r => r.estado === 'RECHAZADO').length, color: 'text-red-500', filter: 'RECHAZADO' },
          ].map(({ label, val, color, filter }) => (
            <button
              key={label}
              onClick={() => setFilterStatus(filter as any)}
              className={`rounded-xl p-3 border text-center transition-all active:scale-95 ${
                filterStatus === filter
                  ? 'border-brand-primary/50 bg-brand-primary/10'
                  : isDark ? 'border-white/8 bg-white/3 hover:bg-white/5' : 'border-gray-100 bg-white shadow-sm hover:border-gray-200'
              }`}
            >
              <div className={`text-xl font-black ${color}`}>{val}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: list + detail */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* List panel */}
        <div className={`w-full md:w-2/5 flex flex-col overflow-hidden border-r ${
          isDark ? 'border-white/5' : 'border-gray-100'
        } ${selected ? 'hidden md:flex' : 'flex'}`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4">
              <Loader2 size={28} className="text-brand-primary animate-spin" />
              <span className={`text-xs font-bold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Cargando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5 border border-white/8' : 'bg-gray-100'}`}>
                <Inbox size={28} className={isDark ? 'text-white/20' : 'text-gray-300'} />
              </div>
              <div>
                <p className={`text-sm font-black mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {filterStatus === 'PENDIENTE' ? 'Sin solicitudes pendientes' : 'Sin resultados'}
                </p>
                <p className={`text-[11px] ${isDark ? 'text-white/25' : 'text-gray-400'}`}>
                  {filterStatus === 'PENDIENTE' ? '¡Todo al día!' : 'Cambia el filtro para ver otras solicitudes.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filtered.map(req => {
                const badge = estadoBadge(req.estado);
                const isSelected = selected?.id === req.id;
                return (
                  <button
                    key={req.id}
                    onClick={() => { setSelected(req); setResponseText(''); setReviewError(''); }}
                    className={`w-full text-left rounded-2xl p-4 border transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'border-brand-primary/50 bg-brand-primary/8'
                        : isDark
                          ? 'border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/5'
                          : 'border-gray-100 bg-white shadow-sm hover:border-brand-primary/20 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isDark ? 'bg-white/8' : 'bg-gray-100'
                      }`}>
                        <User size={16} className={isDark ? 'text-white/50' : 'text-gray-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {req.requester.nombre.split(' ')[0]}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-black ${badge.cls}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>
                        <p className={`text-[11px] font-bold ${isDark ? 'text-brand-primary' : 'text-brand-primary'}`}>
                          {TIPO_LABELS[req.tipo] || req.tipo}
                        </p>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] ${isDark ? 'text-white/35' : 'text-gray-400'}`}>
                          <Calendar size={9} />
                          {formatDate(req.fecha_inicio)} → {formatDate(req.fecha_fin)}
                        </div>
                      </div>
                      <ChevronRight size={14} className={isDark ? 'text-white/20' : 'text-gray-300'} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected ? (
          <div className={`flex-1 flex flex-col overflow-hidden ${!selected ? 'hidden md:flex' : ''}`}>
            {/* Back on mobile */}
            <div className={`md:hidden px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <button
                onClick={() => setSelected(null)}
                className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}
              >
                <X size={14} /> Volver a la lista
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title */}
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/8 border border-white/10' : 'bg-gray-100'}`}>
                  <User size={22} className={isDark ? 'text-white/50' : 'text-gray-400'} />
                </div>
                <div>
                  <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selected.requester.nombre}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                    {selected.requester.turno} · {selected.requester.rol}
                  </p>
                </div>
                <div className="ml-auto">
                  {(() => {
                    const badge = estadoBadge(selected.estado);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black ${badge.cls}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Type + Dates */}
              <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-white/8 bg-white/2' : 'border-gray-100 bg-gray-50'}`}>
                <InfoRow icon={<ClipboardList size={14} />} label="Tipo" value={TIPO_LABELS[selected.tipo] || selected.tipo} isDark={isDark} />
                <InfoRow icon={<Calendar size={14} />} label="Período" value={`${formatDate(selected.fecha_inicio)} → ${formatDate(selected.fecha_fin)}`} isDark={isDark} />
                <InfoRow icon={<Clock size={14} />} label="Enviada" value={formatDate(selected.createdAt)} isDark={isDark} />
              </div>

              {/* Motivo */}
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/8 bg-white/2' : 'border-gray-100 bg-white shadow-sm'}`}>
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                  Motivo de la solicitud
                </div>
                <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  {selected.motivo}
                </p>
                {selected.observaciones && (
                  <>
                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] mt-4 mb-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      Información adicional
                    </div>
                    <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      {selected.observaciones}
                    </p>
                  </>
                )}
              </div>

              {/* Existing response */}
              {selected.respuesta && (
                <div className={`rounded-2xl border-l-4 p-4 ${
                  selected.estado === 'APROBADO'
                    ? (isDark ? 'bg-green-500/5 border-green-500' : 'bg-green-50 border-green-500')
                    : (isDark ? 'bg-red-500/5 border-red-500' : 'bg-red-50 border-red-400')
                }`}>
                  <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 ${
                    selected.estado === 'APROBADO' ? 'text-green-500' : 'text-red-400'
                  }`}>
                    {selected.reviewer?.nombre || 'Supervisor'} respondió:
                  </div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{selected.respuesta}</p>
                </div>
              )}

              {/* Review form (only for PENDIENTE) */}
              {selected.estado === 'PENDIENTE' && (
                <div className={`rounded-2xl border p-4 ${isDark ? 'border-white/8 bg-white/2' : 'border-gray-100 bg-white shadow-sm'}`}>
                  <div className={`flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                    <MessageSquare size={12} />
                    Tu respuesta para el operario
                  </div>
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="Explica brevemente la decisión tomada…"
                    rows={3}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium resize-none focus:outline-none focus:border-brand-primary transition-colors mb-3 ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20'
                        : 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-300'
                    }`}
                  />
                  {reviewError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mb-3">
                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
                      <span className="text-xs font-bold text-red-400">{reviewError}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReview('RECHAZADO')}
                      disabled={isReviewing}
                      className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                        isDark ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25' : 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                      }`}
                    >
                      {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleReview('APROBADO')}
                      disabled={isReviewing}
                      className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 text-white"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 15px rgba(34,197,94,0.3)' }}
                    >
                      {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Aprobar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-4 text-center px-8">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDark ? 'bg-white/3 border border-white/8' : 'bg-gray-100'}`}>
              <ClipboardList size={32} className={isDark ? 'text-white/15' : 'text-gray-300'} />
            </div>
            <div>
              <p className={`text-sm font-black mb-1 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>Selecciona una solicitud</p>
              <p className={`text-[11px] ${isDark ? 'text-white/20' : 'text-gray-300'}`}>
                Haz clic en cualquier solicitud de la lista para ver sus detalles y gestionar la respuesta.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, isDark }: { icon: React.ReactNode; label: string; value: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{icon}</div>
      <span className={`text-[11px] font-bold w-20 shrink-0 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-sm font-black ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
