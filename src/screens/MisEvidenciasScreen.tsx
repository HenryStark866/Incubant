import React, { useState, useEffect, useCallback } from 'react';
import {
  Images, FileText, Download, Calendar, ZoomIn, X, Loader2,
  AlertTriangle, RefreshCw, Image as ImageIcon, ChevronLeft
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { getApiUrl, apiFetch } from '../lib/api';

interface EvidenceItem {
  id: string;
  itemType: 'photo' | 'pdf';
  url: string;
  fecha_hora: string;
  machine: string;
  machineId: string | null;
  observaciones: string;
}

// ─── Full-screen viewer ──────────────────────────────────────────────────────
function EvidenceViewer({
  item,
  onClose,
}: {
  item: EvidenceItem;
  onClose: () => void;
}) {
  const handleDownload = async () => {
    try {
      const resp = await fetch(item.url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item.machine}_${new Date(item.fecha_hora).getTime()}.${item.itemType === 'pdf' ? 'pdf' : 'jpg'}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-5 right-5 p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white"
        onClick={onClose}
      >
        <X size={22} />
      </button>

      {item.itemType === 'photo' ? (
        <img
          src={item.url}
          alt="Mi evidencia"
          className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className="flex flex-col items-center justify-center bg-white/5 rounded-2xl"
          onClick={e => e.stopPropagation()}
          style={{ width: 'min(90vw, 600px)', height: '72vh' }}
        >
          <iframe
            src={item.url}
            className="w-full h-full rounded-xl"
            style={{ border: 'none', background: 'white' }}
            title="PDF Viewer"
          />
        </div>
      )}

      <div
        className="mt-4 bg-white/10 backdrop-blur rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm text-white max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Máquina</span>
          <span className="font-black">{item.machine}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Fecha y Hora</span>
          <span className="font-bold">
            {new Date(item.fecha_hora).toLocaleDateString('es-CO')} ·{' '}
            {new Date(item.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {item.observaciones && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Nota</span>
            <span className="font-medium text-white/80 text-xs truncate">{item.observaciones}</span>
          </div>
        )}
        <button
          onClick={handleDownload}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/80 rounded-xl font-black text-xs uppercase"
        >
          <Download size={14} />
          {item.itemType === 'pdf' ? 'Descargar PDF' : 'Descargar Foto'}
        </button>
        {item.itemType === 'pdf' && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-black text-xs uppercase"
            onClick={e => e.stopPropagation()}
          >
            Abrir en nueva pestaña
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MisEvidenciasScreen({ onBack }: { onBack?: () => void }) {
  const isDark = useThemeStore(state => state.theme) === 'dark';

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [operario, setOperario] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'photo' | 'pdf'>('all');
  const [viewer, setViewer] = useState<EvidenceItem | null>(null);

  const fetchEvidence = useCallback(async () => {
    setLoading(items.length === 0);
    setError(null);
    try {
      const res = await apiFetch(getApiUrl('/api/evidence/mine'));
      if (!res.ok) throw new Error('No se pudo cargar tus evidencias');
      const data = await res.json();
      setItems(data.items || []);
      setOperario(data.operario || '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchEvidence();
    // SSE: refresh on new report
    const es = new EventSource(getApiUrl('/api/events'), { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'NEW_REPORT') fetchEvidence();
      } catch { /* silent */ }
    };
    return () => es.close();
  }, [fetchEvidence]);

  const filtered = items.filter(i => filter === 'all' || i.itemType === filter);

  const handleDownload = async (item: EvidenceItem) => {
    try {
      const resp = await fetch(item.url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item.machine}_${new Date(item.fecha_hora).getTime()}.${item.itemType === 'pdf' ? 'pdf' : 'jpg'}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(item.url, '_blank');
    }
  };

  return (
    <div
      className={`flex flex-col h-full relative overflow-hidden ${isDark ? '' : 'bg-gray-50'}`}
      style={isDark ? { background: '#060b18' } : {}}
    >
      {isDark && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 circuit-bg opacity-30" />
          <div
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.07) 0%, transparent 70%)' }}
          />
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 px-5 pt-8 pb-4 flex items-start gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={`mt-1 p-2 rounded-xl transition-all ${
              isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-white text-brand-gray hover:bg-gray-100'
            }`}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-brand-primary/20 flex items-center justify-center">
              <Images size={16} className="text-brand-primary" />
            </div>
            <h1
              className={`text-lg font-black font-mono-display uppercase tracking-wider ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Mis Evidencias
            </h1>
          </div>
          <p className={`text-[11px] font-medium ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
            {operario ? `${operario} · ` : ''}{items.length} archivo{items.length !== 1 ? 's' : ''}
          </p>
          <div className="mt-2">
            <button
              onClick={() => window.open('/docs/manual_operador.pdf', '_blank')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                isDark 
                  ? 'bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary' 
                  : 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary'
              }`}
            >
              <FileText size={12} /> Ver Instructivo
            </button>
          </div>
        </div>
        <button
          onClick={fetchEvidence}
          className={`p-2 rounded-xl transition-all mt-1 ${
            isDark ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-white hover:bg-gray-100 text-brand-gray'
          }`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      <div className="relative z-10 px-5 pb-4 flex gap-2">
        {(['all', 'photo', 'pdf'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
              filter === f
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30'
                : isDark
                ? 'bg-white/5 text-white/50 hover:bg-white/10'
                : 'bg-white text-brand-gray hover:bg-gray-100 shadow-sm border border-gray-100'
            }`}
          >
            {f === 'all' && 'Todos'}
            {f === 'photo' && <><ImageIcon size={12} /> Fotos</>}
            {f === 'pdf' && <><FileText size={12} /> PDFs</>}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <Loader2 className="animate-spin text-brand-primary" size={32} />
            <p className={`font-bold text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              Cargando tus evidencias...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
            <AlertTriangle className="text-red-500" size={32} />
            <p className="font-bold text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchEvidence}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl font-black text-xs uppercase"
            >
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
            <Images
              size={52}
              className={isDark ? 'text-white/10' : 'text-gray-200'}
            />
            <p className={`font-bold text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              {items.length === 0
                ? 'Aún no tienes evidencias registradas'
                : 'No hay ' + (filter === 'photo' ? 'fotos' : 'PDFs') + ' en tus registros'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => (
              <div
                key={item.id}
                className={`rounded-2xl border overflow-hidden flex flex-col transition-all active:scale-95 cursor-pointer group ${
                  isDark
                    ? 'bg-white/5 border-white/5 hover:border-white/20'
                    : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-brand-primary/20'
                }`}
                onClick={() => setViewer(item)}
              >
                {/* Image or PDF icon */}
                {item.itemType === 'photo' ? (
                  <div className="aspect-square relative bg-black/10 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.machine}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <ZoomIn
                        size={24}
                        className="text-white opacity-0 group-hover:opacity-100 transition-all"
                      />
                    </div>
                    {/* Machine badge */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="bg-black/60 backdrop-blur text-white text-[9px] font-black px-2 py-0.5 rounded-md">
                        {item.machine}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="aspect-square flex flex-col items-center justify-center gap-2 bg-white relative"
                  >
                    <iframe
                      src={item.url}
                      className="w-full h-full"
                      style={{ border: 'none' }}
                      title={`PDF ${item.machine}`}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur text-white text-[9px] font-black px-2 py-0.5 text-center">
                      {item.machine}
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className="p-3 flex flex-col gap-1">
                  <p
                    className={`text-[11px] font-black truncate ${
                      isDark ? 'text-white' : 'text-brand-dark'
                    }`}
                  >
                    {item.machine}
                  </p>
                  <div
                    className={`flex items-center gap-1 text-[9px] font-bold ${
                      isDark ? 'text-white/30' : 'text-gray-400'
                    }`}
                  >
                    <Calendar size={9} />
                    {new Date(item.fecha_hora).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    ·{' '}
                    {new Date(item.fecha_hora).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDownload(item);
                    }}
                    className={`mt-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      isDark
                        ? 'bg-white/5 hover:bg-brand-primary/20 text-white/50 hover:text-brand-primary'
                        : 'bg-gray-50 hover:bg-brand-primary/10 text-gray-400 hover:text-brand-primary'
                    }`}
                  >
                    <Download size={10} />
                    {item.itemType === 'pdf' ? 'Descargar PDF' : 'Descargar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer */}
      {viewer && <EvidenceViewer item={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
