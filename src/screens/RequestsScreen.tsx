import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, X, CheckCircle2, Clock, XCircle, Loader2,
  Calendar, FileText, ChevronDown, AlertTriangle, ArrowLeft, Trash2,
  RefreshCw
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { useMachineStore } from '../store/useMachineStore';
import { getApiUrl, apiFetch } from '../lib/api';

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

const TIPOS = [
  { value: 'PERMISO', label: '📋 Permiso Personal', desc: 'Solicitud de permiso por horas o días' },
  { value: 'VACACIONES', label: '🌴 Vacaciones', desc: 'Período de descanso remunerado' },
  { value: 'AUSENCIA', label: '🏥 Ausencia Médica', desc: 'Incapacidad o cita médica' },
  { value: 'OTRO', label: '📝 Otro', desc: 'Otros tipos de solicitud' },
];

const estadoBadge = (estado: string) => {
  switch (estado) {
    case 'APROBADO':
      return { icon: <CheckCircle2 size={12} />, label: 'Aprobado', cls: 'bg-green-500/15 text-green-400 border-green-500/30' };
    case 'RECHAZADO':
      return { icon: <XCircle size={12} />, label: 'Rechazado', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
    default:
      return { icon: <Clock size={12} />, label: 'Pendiente', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  }
};

const tipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label || tipo;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function RequestsScreen({ onBack }: { onBack: () => void }) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const currentUser = useMachineStore(s => s.currentUser);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    tipo: 'PERMISO',
    fecha_inicio: '',
    fecha_fin: '',
    motivo: '',
    observaciones: '',
  });
  const [formError, setFormError] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = await apiFetch(getApiUrl('/api/requests'));
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('[RequestsScreen] Error fetching:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  // SSE: auto-refresh when supervisor reviews a request
  useEffect(() => {
    if (!currentUser) return;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      try {
        es = new EventSource(getApiUrl('/api/events'));
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'REQUEST_REVIEWED') {
              void fetchRequests(); // refresh list to get updated status + response
            }
          } catch { /* ignore parse errors */ }
        };
        es.onerror = () => {
          es?.close();
          retryTimer = setTimeout(connect, 5000);
        };
      } catch {
        retryTimer = setTimeout(connect, 5000);
      }
    };
    connect();
    return () => { es?.close(); clearTimeout(retryTimer); };
  }, [currentUser, fetchRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.fecha_inicio || !form.fecha_fin) {
      setFormError('Las fechas son obligatorias');
      return;
    }
    if (new Date(form.fecha_fin) < new Date(form.fecha_inicio)) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }
    if (form.motivo.trim().length < 10) {
      setFormError('El motivo debe tener al menos 10 caracteres');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(getApiUrl('/api/requests'), {
        method: 'POST',
        body: JSON.stringify({
          tipo: form.tipo,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          motivo: form.motivo.trim(),
          observaciones: form.observaciones.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.details ? `${err.error}: ${err.details}` : (err.error || 'Error al enviar la solicitud'));
        return;
      }

      const created = await res.json();
      setRequests(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ tipo: 'PERMISO', fecha_inicio: '', fecha_fin: '', motivo: '', observaciones: '' });
    } catch {
      setFormError('Error de conexión. Verifica tu red e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Cancelar esta solicitud?')) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(getApiUrl(`/api/requests/${id}`), { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setRequests(prev => prev.filter(r => r.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || 'No se pudo cancelar');
      }
    } catch {
      alert('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const pending = requests.filter(r => r.estado === 'PENDIENTE');
  const resolved = requests.filter(r => r.estado !== 'PENDIENTE');
  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      className={`flex flex-col h-full relative overflow-hidden font-sans`}
      style={{ background: isDark ? '#060b18' : '#f8fafc' }}
    >
      {/* Background decoration */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 circuit-bg opacity-20" />
          <div className="absolute -top-20 right-0 w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.06), transparent 70%)' }} />
        </div>
      )}

      {/* Header */}
      <div className={`relative z-10 shrink-0 px-5 pt-12 pb-4 border-b ${isDark ? 'border-white/5' : 'border-gray-200'}`}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              isDark ? 'border-white/10 bg-white/5 text-white/60 hover:text-white' : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className={`text-[10px] font-black uppercase tracking-[0.25em] mb-0.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
              Módulo
            </div>
            <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Solicitudes y Permisos
            </h1>
          </div>
          <button
            onClick={() => fetchRequests()}
            className={`p-2 rounded-xl border transition-all active:scale-95 ${
              isDark ? 'border-white/10 bg-white/5 text-white/40' : 'border-gray-200 bg-white text-gray-400'
            }`}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pendientes', val: pending.length, color: 'text-amber-400', bg: isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200' },
            { label: 'Aprobadas', val: requests.filter(r => r.estado === 'APROBADO').length, color: 'text-green-400', bg: isDark ? 'bg-green-500/10 border-green-500/20' : 'bg-green-50 border-green-200' },
            { label: 'Rechazadas', val: requests.filter(r => r.estado === 'RECHAZADO').length, color: 'text-red-400', bg: isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200' },
          ].map(({ label, val, color, bg }) => (
            <div key={label} className={`rounded-xl p-3 border text-center ${bg}`}>
              <div className={`text-lg font-black ${color}`}>{val}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10 px-5 py-4" style={{ paddingBottom: '100px' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 size={32} className="text-brand-primary animate-spin" />
            <span className={`text-xs font-bold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Cargando solicitudes...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100'}`}>
              <ClipboardList size={28} className={isDark ? 'text-white/20' : 'text-gray-300'} />
            </div>
            <div>
              <p className={`text-sm font-black mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Sin solicitudes aún</p>
              <p className={`text-[11px] ${isDark ? 'text-white/25' : 'text-gray-400'}`}>
                Crea tu primera solicitud de permiso o vacaciones
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Pending */}
            {pending.length > 0 && (
              <section>
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                  <Clock size={11} className="text-amber-400" />
                  Pendientes de revisión ({pending.length})
                </div>
                <div className="space-y-2.5">
                  {pending.map(req => <RequestCard key={req.id} req={req} isDark={isDark} onDelete={handleDelete} deletingId={deletingId} />)}
                </div>
              </section>
            )}
            {/* Resolved */}
            {resolved.length > 0 && (
              <section>
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                  <FileText size={11} />
                  Historial de solicitudes
                </div>
                <div className="space-y-2.5">
                  {resolved.map(req => <RequestCard key={req.id} req={req} isDark={isDark} onDelete={handleDelete} deletingId={deletingId} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* FAB - Nueva Solicitud */}
      <div className={`absolute bottom-0 inset-x-0 z-20 px-5 pb-6 pt-8 ${isDark ? '' : 'bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent'}`}
        style={isDark ? { background: 'linear-gradient(to top, #060b18 55%, transparent)' } : {}}>
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.97] text-white uppercase tracking-widest"
          style={{ background: 'linear-gradient(135deg, #f7931a 0%, #ffb800 100%)', boxShadow: '0 8px 32px rgba(247,147,26,0.35)' }}
        >
          <Plus size={18} />
          Nueva Solicitud
        </button>
      </div>

      {/* New Request Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-end justify-center p-4"
          onClick={() => { if (!isSubmitting) setShowForm(false); }}
        >
          <div
            className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: isDark ? '#0d1526' : 'white', border: '1px solid rgba(247,147,26,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header gradient bar */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, #f7931a, #ffb800, transparent)' }} />
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Nueva Solicitud</h2>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                    Enviada a {currentUser?.role === 'JEFE' ? 'administración' : 'tu supervisor'}
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  disabled={isSubmitting}
                  className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-white/50' : 'bg-gray-100 text-gray-400'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo */}
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Tipo de Solicitud
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                          form.tipo === t.value
                            ? 'bg-brand-primary/15 border-brand-primary/60 text-brand-primary'
                            : isDark
                              ? 'bg-white/3 border-white/10 text-white/50 hover:border-white/20'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                      >
                        <div className="text-xs font-black">{t.label}</div>
                        <div className={`text-[9px] mt-0.5 ${form.tipo === t.value ? 'text-brand-primary/70' : isDark ? 'text-white/25' : 'text-gray-400'}`}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-[0.15em] mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={form.fecha_inicio}
                      min={today}
                      onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
                      required
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:border-brand-primary transition-colors ${
                        isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-[0.15em] mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={form.fecha_fin}
                      min={form.fecha_inicio || today}
                      onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))}
                      required
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:border-brand-primary transition-colors ${
                        isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'
                      }`}
                    />
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-[0.15em] mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Motivo <span className="text-brand-primary">*</span>
                  </label>
                  <textarea
                    value={form.motivo}
                    onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                    placeholder="Describe brevemente el motivo de la solicitud…"
                    rows={3}
                    required
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium resize-none focus:outline-none focus:border-brand-primary transition-colors ${
                      isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-300'
                    }`}
                  />
                </div>

                {/* Observaciones */}
                <div>
                  <label className={`block text-[10px] font-black uppercase tracking-[0.15em] mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Información adicional <span className="opacity-50">(opcional)</span>
                  </label>
                  <textarea
                    value={form.observaciones}
                    onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Documentos de soporte, teléfono de contacto, etc."
                    rows={2}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-medium resize-none focus:outline-none focus:border-brand-primary transition-colors ${
                      isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-white border-gray-200 text-gray-800 placeholder:text-gray-300'
                    }`}
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
                    <AlertTriangle size={13} className="text-red-400 shrink-0" />
                    <span className="text-xs font-bold text-red-400">{formError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={isSubmitting}
                    className={`flex-1 py-3 rounded-xl font-black text-sm border transition-all ${
                      isDark ? 'border-white/10 text-white/50' : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #f7931a, #ffb800)' }}
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  req, isDark, onDelete, deletingId
}: {
  req: LeaveRequest;
  isDark: boolean;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const badge = estadoBadge(req.estado);

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      isDark
        ? 'bg-white/3 border-white/8'
        : 'bg-white border-gray-100 shadow-sm'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {tipoLabel(req.tipo)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${badge.cls}`}>
              {badge.icon}
              {badge.label}
            </span>
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            <Calendar size={10} />
            {formatDate(req.fecha_inicio)}
            {req.fecha_fin !== req.fecha_inicio && ` → ${formatDate(req.fecha_fin)}`}
          </div>
        </div>

        {req.estado === 'PENDIENTE' && (
          <button
            onClick={() => onDelete(req.id)}
            disabled={deletingId === req.id}
            className={`p-1.5 rounded-lg transition-all active:scale-95 ${
              isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-400 hover:bg-red-100'
            }`}
          >
            {deletingId === req.id
              ? <Loader2 size={13} className="animate-spin" />
              : <Trash2 size={13} />
            }
          </button>
        )}
      </div>

      {/* Motivo */}
      <p className={`text-xs font-medium leading-relaxed mb-2 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
        {req.motivo}
      </p>

      {/* Respuesta del supervisor */}
      {req.respuesta && (
        <div className={`mt-3 px-3 py-2 rounded-xl border-l-2 ${
          req.estado === 'APROBADO' ? 'border-green-400 bg-green-500/5' : 'border-red-400 bg-red-500/5'
        }`}>
          <div className={`text-[9px] font-black uppercase tracking-[0.15em] mb-1 ${
            req.estado === 'APROBADO' ? 'text-green-400' : 'text-red-400'
          }`}>
            {req.reviewer?.nombre || 'Supervisor'} respondió:
          </div>
          <p className={`text-[11px] font-medium ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{req.respuesta}</p>
        </div>
      )}

      {/* Footer */}
      <div className={`flex items-center justify-between mt-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <span className={`text-[10px] font-medium ${isDark ? 'text-white/25' : 'text-gray-400'}`}>
          Enviada {formatDate(req.createdAt)}
        </span>
      </div>
    </div>
  );
}
