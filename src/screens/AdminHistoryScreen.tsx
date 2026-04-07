import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Download, Calendar, Image as ImageIcon,
  FileText, AlertTriangle, X, RefreshCw, ChevronDown,
  ZoomIn, FileArchive, Loader2, Filter
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { getApiUrl, apiFetch } from '../lib/api';

// ─── Machine selector options ──────────────────────────────────────────────
const INC_OPTIONS = Array.from({ length: 24 }, (_, i) => `INC-${(i + 1).toString().padStart(2, '0')}`);
const NAC_OPTIONS = Array.from({ length: 12 }, (_, i) => `NAC-${(i + 1).toString().padStart(2, '0')}`);
const ALL_MACHINES = ['Todas', ...INC_OPTIONS, ...NAC_OPTIONS];

// ─── Viewer Modal ───────────────────────────────────────────────────────────
function PhotoViewer({
  item,
  onClose,
  onDownload,
}: {
  item: any;
  onClose: () => void;
  onDownload: (url: string, name: string) => void;
}) {
  const machineName = item.machine
    ? `${item.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${item.machine.numero_maquina?.toString().padStart(2, '0')}`
    : '—';

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-5 right-5 p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors z-10"
        onClick={onClose}
      >
        <X size={22} />
      </button>

      {/* Image */}
      <img
        src={item.photo_url}
        alt="Evidencia"
        className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-2xl select-none"
        onClick={e => e.stopPropagation()}
      />

      {/* Meta-info bar */}
      <div
        className="mt-4 bg-white/10 backdrop-blur rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4 text-sm text-white max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Máquina</span>
          <span className="font-black">{machineName}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Operario</span>
          <span className="font-bold">{item.user?.nombre || '—'}</span>
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
            <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">Observaciones</span>
            <span className="font-medium text-white/80 truncate">{item.observaciones}</span>
          </div>
        )}
        <button
          onClick={() =>
            onDownload(
              item.photo_url,
              `Evidencia-${machineName}-${new Date(item.fecha_hora).getTime()}.jpg`
            )
          }
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/80 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
        >
          <Download size={14} /> Descargar
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AdminHistoryScreen() {
  const isDark = useThemeStore(state => state.theme) === 'dark';

  const [logs, setLogs] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photos' | 'incidents' | 'reports'>('all');
  const [selectedMachine, setSelectedMachine] = useState('Todas');
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(getApiUrl('/api/reports/history'));
      const contentType = res.headers.get('content-type');
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: Fallo al conectar con el servidor.`);
      }
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Expected JSON, got:', text.slice(0, 500));
        throw new Error('El servidor devolvió un formato incorrecto (HTML). Verifique la ruta API.');
      }
      
      const data = await res.json();
      setLogs(data.logs || []);
      setIncidents(data.incidents || []);
      setReports(data.reports || []);
    } catch (err: any) {
      console.error('[History] Fetch failed:', err);
      setError(err.message === 'Unexpected token < in JSON at position 0' 
        ? 'Error de ruta: El servidor devolvió una página HTML en lugar de datos JSON.' 
        : err.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh via SSE: listen for NEW_REPORT events
  useEffect(() => {
    fetchHistory();
    const apiUrl = getApiUrl('/api/events');
    const es = new EventSource(apiUrl, { withCredentials: true });
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'NEW_REPORT') fetchHistory();
      } catch { /* silent */ }
    };
    return () => es.close();
  }, [fetchHistory]);

  const handleDownloadPhoto = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    const items = filteredData.filter(i => i.itemType === 'log' && i.photo_url);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const machineName = item.machine
        ? `${item.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${item.machine.numero_maquina?.toString().padStart(2, '0')}`
        : 'SIN-MAQUINA';
      await handleDownloadPhoto(
        item.photo_url,
        `${machineName}_${new Date(item.fecha_hora).getTime()}.jpg`
      );
      await new Promise(r => setTimeout(r, 200));
    }
    setDownloadingAll(false);
  };

  // Combine and filter
  const combinedData = [
    ...logs.map(l => ({ ...l, itemType: 'log', uniqueId: `log_${l.id}` })),
    ...incidents.map(i => ({ ...i, itemType: 'incident', uniqueId: `inc_${i.id}` })),
    ...reports.map(r => ({ ...r, itemType: 'report', uniqueId: `rep_${r.id}` })),
  ].sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());

  const filteredData = combinedData.filter(item => {
    if (filterType === 'photos' && (item.itemType !== 'log' || !item.photo_url)) return false;
    if (filterType === 'incidents' && item.itemType !== 'incident') return false;
    if (filterType === 'reports' && item.itemType !== 'report') return false;

    // Machine filter
    if (selectedMachine !== 'Todas' && item.itemType === 'log') {
      if (!item.machine) return false;
      const prefix = item.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC';
      const machineStr = `${prefix}-${item.machine.numero_maquina?.toString().padStart(2, '0')}`;
      if (machineStr !== selectedMachine) return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const userName = item.user?.nombre?.toLowerCase() || '';
      const machineName = item.machine?.numero_maquina
        ? `${item.machine.tipo} ${item.machine.numero_maquina}`.toLowerCase()
        : '';
      const notes = (item.observaciones || item.descripcion || item.titulo || '').toLowerCase();
      return userName.includes(query) || machineName.includes(query) || notes.includes(query);
    }
    return true;
  });

  const photosInFilter = filteredData.filter(i => i.itemType === 'log' && i.photo_url).length;

  return (
    <div
      className={`rounded-[2rem] overflow-hidden shadow-sm h-full flex flex-col ${
        isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'
      }`}
    >
      {/* Header */}
      <div
        className={`p-6 sm:p-8 border-b flex flex-col gap-4 ${
          isDark ? 'border-white/5' : 'border-gray-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>
              Historial y Evidencias
            </h2>
            <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
              Bóveda centralizada · {combinedData.length} registros
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
               onClick={() => window.open('/docs/manual_administrador.pdf', '_blank')}
               className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                 isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-brand-gray hover:bg-gray-200'
               }`}
             >
               <FileText size={14} /> Instructivo Admin
             </button>
             <button
               onClick={() => window.open('/docs/propuesta_mejora.pdf', '_blank')}
               className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20`}
             >
               <FileText size={14} /> Propuesta Mejora
             </button>
            {photosInFilter > 0 && (
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-brand-primary text-white hover:bg-brand-primary/80 transition-all disabled:opacity-50"
                title="Descargar todas las fotos visibles"
              >
                {downloadingAll ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileArchive size={14} />
                )}
                <span className="hidden sm:inline">
                  {downloadingAll ? 'Descargando...' : `Descargar ${photosInFilter} fotos`}
                </span>
              </button>
            )}
            <button
              onClick={fetchHistory}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-brand-dark'
              }`}
              title="Refrescar"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search + filters row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
            <input
              type="text"
              placeholder="Buscar por operario, máquina..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-2.5 rounded-2xl font-bold text-sm outline-none transition-all ${
                isDark
                  ? 'bg-white/5 text-white placeholder-white/30 focus:bg-white/10'
                  : 'bg-gray-50 text-brand-dark placeholder-gray-400 focus:ring-2 focus:ring-brand-primary/20'
              }`}
            />
          </div>

          {/* Machine filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" size={14} />
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(e.target.value)}
              className={`pl-8 pr-8 py-2.5 rounded-2xl font-bold text-sm outline-none appearance-none transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 text-white focus:bg-white/10'
                  : 'bg-gray-50 text-brand-dark focus:ring-2 focus:ring-brand-primary/20'
              }`}
            >
              {ALL_MACHINES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" />
          </div>

          {/* Type filter */}
          <div className="flex gap-2">
            {(['all', 'photos', 'incidents', 'reports'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  filterType === f
                    ? f === 'incidents'
                      ? 'bg-red-500 text-white'
                      : 'bg-brand-primary text-white'
                    : isDark
                    ? 'bg-white/5 text-white/50 hover:bg-white/10'
                    : 'bg-gray-100 text-brand-gray hover:bg-gray-200'
                }`}
              >
                {f === 'all' && 'Todo'}
                {f === 'photos' && <><ImageIcon size={12} /> Fotos</>}
                {f === 'incidents' && <><AlertTriangle size={12} /> Novedades</>}
                {f === 'reports' && <><Download size={12} /> Reportes PDF</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <Loader2 className="animate-spin text-brand-primary" size={32} />
            <p className={`font-bold ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>
              Cargando historial...
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-red-500/5 rounded-3xl border border-red-500/10">
          <AlertTriangle size={64} className="text-red-500 mb-4 opacity-40" />
          <h3 className="text-lg font-black text-red-500 mb-2">Error de Sincronización</h3>
          <p className="max-w-md text-sm font-medium text-red-500/80 mb-6 leading-relaxed">
            {error} <br/>
            <span className="text-xs opacity-60">Esto sucede si el servidor de reportes no responde con los datos esperados (JSON).</span>
          </p>
          <button
            onClick={fetchHistory}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg active:scale-95"
          >
            <RefreshCw size={16} /> Reintentar Conexión
          </button>
        </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
            <FileText className={isDark ? 'text-white/20' : 'text-gray-300'} size={48} />
            <p className={`font-bold ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>
              No se encontraron resultados
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredData.map((item, idx) => {
              const machineName = item.machine
                ? `${item.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${item.machine.numero_maquina?.toString().padStart(2, '0')}`
                : '—';
              const dateStr = new Date(item.fecha_hora).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
              });
              const timeStr = new Date(item.fecha_hora).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.uniqueId}
                  className={`rounded-2xl border flex flex-col overflow-hidden transition-all hover:shadow-xl group ${
                    isDark
                      ? 'bg-white/5 border-white/5 hover:border-white/20'
                      : 'bg-white border-gray-100 hover:border-brand-primary/30 shadow-sm'
                  }`}
                >
                  {/* Thumbnail */}
                  {item.itemType === 'log' && item.photo_url ? (
                    <div
                      className="aspect-square relative cursor-pointer bg-black/10 overflow-hidden"
                      onClick={() => setSelectedPhoto(item)}
                    >
                      <img
                        src={item.photo_url}
                        alt="Evidencia"
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-all bg-white/20 rounded-full p-3">
                          <ZoomIn className="text-white" size={20} />
                        </div>
                      </div>
                      {/* Machine badge */}
                      <div className="absolute top-2 left-2 bg-brand-primary text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow">
                        {machineName}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`aspect-square flex flex-col items-center justify-center gap-2 ${
                        item.itemType === 'incident'
                          ? 'bg-red-500/5'
                          : isDark
                          ? 'bg-white/5'
                          : 'bg-gray-50'
                      }`}
                    >
                      {item.itemType === 'incident' ? (
                        <AlertTriangle size={36} className="text-red-400 opacity-60" />
                      ) : item.itemType === 'report' ? (
                        <FileText size={36} className="text-brand-primary opacity-80" />
                      ) : (
                        <FileText size={36} className={isDark ? 'text-white/20' : 'text-gray-300'} />
                      )}
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.itemType === 'incident'
                            ? 'bg-red-500/10 text-red-500'
                            : item.itemType === 'report'
                            ? 'bg-brand-primary/10 text-brand-primary'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {item.itemType === 'incident' ? 'Novedad' : item.itemType === 'report' ? 'Reporte PDF' : 'Sin foto'}
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <p className={`text-[10px] font-black truncate ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                      {item.itemType === 'incident' 
                        ? (item.titulo || 'Novedad') 
                        : item.itemType === 'report' 
                          ? (item.isClosingReport ? 'Cierre de Turno' : `Reporte ${machineName}`)
                          : machineName}
                    </p>
                    <p className={`text-[9px] font-bold truncate ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
                      {item.user?.nombre?.split(' ')[0] || 'Sistema'}
                    </p>
                    <div className={`flex items-center gap-1 text-[9px] font-bold ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      <Calendar size={9} />
                      {dateStr} · {timeStr}
                    </div>

                    {/* Metrics for Logs */}
                    {item.itemType === 'log' && (
                      <div className="mt-1 flex flex-wrap gap-1.5 border-t border-white/5 pt-1.5">
                        {item.temp_principal_actual != null && (
                          <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${isDark ? 'bg-white/5 text-brand-primary' : 'bg-brand-primary/10 text-brand-primary'}`}>
                            {item.temp_principal_actual.toFixed(1)}°
                          </div>
                        )}
                        {item.humedad_actual != null && (
                          <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${isDark ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            {item.humedad_actual.toFixed(1)}%
                          </div>
                        )}
                        {item.co2_actual != null && (
                          <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${isDark ? 'bg-white/5 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                            {item.co2_actual.toFixed(0)}ppm
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {(item.itemType === 'log' && item.photo_url) ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDownloadPhoto(
                            item.photo_url,
                            `${machineName}_${new Date(item.fecha_hora).getTime()}.jpg`
                          );
                        }}
                        className={`mt-1 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                          isDark
                            ? 'bg-white/5 hover:bg-brand-primary/20 text-white/60 hover:text-brand-primary'
                            : 'bg-gray-50 hover:bg-brand-primary/10 text-brand-gray hover:text-brand-primary'
                        }`}
                      >
                        <Download size={10} /> Descargar
                      </button>
                    ) : item.itemType === 'report' ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (item.pdfUrl) window.open(item.pdfUrl, '_blank');
                        }}
                        disabled={!item.pdfUrl}
                        className={`mt-1 flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                          !item.pdfUrl 
                            ? 'bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed'
                            : isDark
                              ? 'bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary'
                              : 'bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary'
                        }`}
                      >
                        <FileText size={10} /> {item.pdfUrl ? 'Abrir PDF' : 'Error PDF'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <PhotoViewer
          item={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDownload={handleDownloadPhoto}
        />
      )}
    </div>
  );
}
