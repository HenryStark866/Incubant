import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, Image as ImageIcon, FileText, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { getApiUrl, apiFetch } from '../lib/api';

export default function AdminHistoryScreen() {
  const isDark = useThemeStore(state => state.theme) === 'dark';
  
  const [logs, setLogs] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photos' | 'incidents'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(getApiUrl('/api/reports/history'));
      if (!res.ok) throw new Error('Error al obtener el historial');
      const data = await res.json();
      setLogs(data.logs || []);
      setIncidents(data.incidents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
    } catch (err) {
      console.error('Error downloading photo', err);
      // Fallback
      window.open(url, '_blank');
    }
  };

  const combinedData = [
    ...logs.map(l => ({ ...l, itemType: 'log' })),
    ...incidents.map(i => ({ ...i, itemType: 'incident' }))
  ].sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime());

  const filteredData = combinedData.filter(item => {
    if (filterType === 'photos' && item.itemType !== 'log') return false;
    if (filterType === 'incidents' && item.itemType !== 'incident') return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const userName = item.user?.nombre?.toLowerCase() || '';
      const machineName = item.machine?.numero_maquina ? `${item.machine.tipo} ${item.machine.numero_maquina}`.toLowerCase() : '';
      const notes = (item.observaciones || item.descripcion || item.titulo || '').toLowerCase();
      return userName.includes(query) || machineName.includes(query) || notes.includes(query);
    }
    return true;
  });

  return (
    <div className={`rounded-[2rem] overflow-hidden shadow-sm h-full flex flex-col ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
      <div className={`p-6 sm:p-8 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isDark ? 'border-white/5' : 'border-gray-50'}`}>
        <div>
          <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>Historial y Reportes</h2>
          <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Auditoría centralizada de todos los turnos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchHistory}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-brand-dark'}`}
            title="Refrescar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
            <input
              type="text"
              placeholder="Buscar por operario, máquina o palabras clave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 rounded-2xl font-bold text-sm outline-none transition-all ${isDark ? 'bg-white/5 text-white placeholder-white/30 focus:bg-white/10' : 'bg-gray-50 text-brand-dark placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary'}`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filterType === 'all' ? 'bg-brand-primary text-white' : isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-gray-100 text-brand-gray hover:bg-gray-200'}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('photos')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${filterType === 'photos' ? 'bg-brand-primary text-white' : isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-gray-100 text-brand-gray hover:bg-gray-200'}`}
            >
              <ImageIcon size={14} /> Fotos
            </button>
            <button
              onClick={() => setFilterType('incidents')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${filterType === 'incidents' ? 'bg-red-500 text-white' : isDark ? 'bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-white/50' : 'bg-gray-100 hover:bg-red-50 hover:text-red-500 text-brand-gray'}`}
            >
              <AlertTriangle size={14} /> Novedades
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto rounded-2xl border ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 h-full gap-4">
              <RefreshCw className="animate-spin text-brand-primary" size={32} />
              <p className={`font-bold ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 h-full gap-4 text-center">
              <AlertTriangle className="text-red-500" size={32} />
              <p className={`font-bold text-red-500`}>{error}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 h-full gap-4 text-center">
              <FileText className={isDark ? 'text-white/20' : 'text-gray-300'} size={48} />
              <p className={`font-bold ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>No se encontraron resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredData.map((item, idx) => (
                <div key={item.id || idx} className={`rounded-xl border flex flex-col overflow-hidden transition-all hover:shadow-lg ${isDark ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-white border-gray-100 hover:border-brand-primary/30'}`}>
                  {item.itemType === 'log' && item.photo_url ? (
                    <div 
                      className="aspect-square relative cursor-pointer group bg-black/5"
                      onClick={() => setSelectedPhoto(item.photo_url)}
                    >
                      <img 
                        src={item.photo_url} 
                        alt="Evidencia" 
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all" size={32} />
                      </div>
                    </div>
                  ) : (
                    <div className={`aspect-square flex items-center justify-center ${item.itemType === 'incident' ? 'bg-red-500/5' : isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      {item.itemType === 'incident' ? (
                        <AlertTriangle size={48} className="text-red-400 opacity-50" />
                      ) : (
                        <FileText size={48} className={isDark ? 'text-white/20' : 'text-gray-300'} />
                      )}
                    </div>
                  )}
                  
                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-1 rounded-md ${item.itemType === 'incident' ? 'bg-red-500/10 text-red-500' : 'bg-brand-primary/10 text-brand-primary'}`}>
                        {item.itemType === 'incident' ? 'Novedad' : 'Reporte'}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <Calendar size={10} />
                        {new Date(item.fecha_hora).toLocaleDateString()} {new Date(item.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    
                    <div className="mt-2">
                       <p className={`font-black text-sm truncate ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                         {item.machine?.tipo} {item.machine?.numero_maquina} {item.titulo ? `- ${item.titulo}` : ''}
                       </p>
                       <p className={`text-xs font-bold mt-1 ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>
                         Operario: {item.user?.nombre}
                       </p>
                    </div>

                    <p className={`text-xs font-medium mt-2 line-clamp-2 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                      {item.observaciones || item.descripcion || "Sin observaciones."}
                    </p>

                    {item.photo_url && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadPhoto(item.photo_url, `Evidencia-${item.machine?.tipo || 'INC'}-${new Date(item.fecha_hora).getTime()}.jpg`); }}
                        className="mt-4 flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-brand-dark text-xs font-bold transition-colors"
                      >
                        <Download size={14} /> Descargar Foto
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
           <button 
             className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
             onClick={() => setSelectedPhoto(null)}
           >
             <X size={24} />
           </button>
           <img src={selectedPhoto} alt="Visor de Evidencia" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
