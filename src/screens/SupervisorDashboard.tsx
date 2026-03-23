import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, Clock, Users, LayoutDashboard, 
  Settings, ChevronDown, X, Image as ImageIcon, CheckCircle2,
  Download, Loader2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const MOCK_OPERATORS = [
  { id: 1, name: 'Juan Pérez', shift: 'Mañana (06:00 - 14:00)', status: 'Activo' },
  { id: 2, name: 'María Gómez', shift: 'Tarde (14:00 - 22:00)', status: 'Descanso' },
  { id: 3, name: 'Carlos Ruiz', shift: 'Noche (22:00 - 06:00)', status: 'Descanso' },
];

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal'>('dashboard');
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [chartFilter, setChartFilter] = useState('Todas (Promedio)');

  const [machinesData, setMachinesData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, trendsRes] = await Promise.all([
          fetch('/api/dashboard/status'),
          fetch('/api/dashboard/trends')
        ]);
        
        const statusJson = await statusRes.json();
        const trendsJson = await trendsRes.json();
        
        if (statusRes.ok && Array.isArray(statusJson)) {
          setMachinesData(statusJson);
        } else {
          setMachinesData([]);
        }

        if (trendsRes.ok && Array.isArray(trendsJson)) {
          setTrendsData(trendsJson);
        } else {
          setTrendsData([]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setMachinesData([]);
        setTrendsData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Refresh every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const activeAlarms = machinesData.filter(m => m.status === 'alarm').length;

  const handleDownloadReport = () => {
    window.open('/api/reports/latest', '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-300 items-center justify-center flex-col gap-4">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
        <p className="text-lg font-medium animate-pulse">Cargando datos de planta...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Activity className="text-blue-500" size={28} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AgriMonitor</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">SCADA System</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'dashboard' ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Panel Principal</span>
          </button>
          <button 
            onClick={() => setActiveTab('personal')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'personal' ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Users size={20} />
            <span className="font-medium">Gestión Personal</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
            <Settings size={20} />
            <span className="font-medium">Configuración</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Bar - KPIs */}
        <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
          
          {/* Operario Info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-700/50">
                <Users size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Operario en Turno</p>
                <p className="text-sm font-bold text-white">Juan Pérez</p>
              </div>
            </div>
            
            <div className="w-48">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Cumplimiento Recorrido</span>
                <span className="text-blue-400 font-bold">80%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-4/5 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDownloadReport}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-blue-900/20 border border-blue-500 mr-4"
            >
              <Download size={18} />
              Descargar Reporte
            </button>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500" size={20} />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Reportes Hoy</p>
                <p className="text-lg font-black text-white leading-none">142</p>
              </div>
            </div>

            <div className={`border rounded-lg px-4 py-2 flex items-center gap-3 ${
              activeAlarms > 0 ? 'bg-red-950/30 border-red-900/50' : 'bg-slate-800/50 border-slate-700'
            }`}>
              <AlertTriangle className={activeAlarms > 0 ? 'text-red-500' : 'text-slate-500'} size={20} />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Alarmas Activas</p>
                <p className={`text-lg font-black leading-none ${activeAlarms > 0 ? 'text-red-400' : 'text-white'}`}>
                  {activeAlarms}
                </p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg px-4 py-2 flex items-center gap-3 animate-pulse">
              <Clock className="text-amber-500" size={20} />
              <div>
                <p className="text-[10px] text-amber-500/80 uppercase font-bold">Próximo Cambio</p>
                <p className="text-lg font-black text-amber-400 leading-none">14:00</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
              
              {/* Heatmap Section */}
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-blue-500" />
                  Mapa de Planta (Estado en Tiempo Real)
                </h2>
                
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="mb-4 flex gap-4 text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> OK</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Alarma</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-600"></span> Mantenimiento</div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Incubadoras</h3>
                      <div className="grid grid-cols-8 gap-3">
                        {machinesData.filter(m => m.type === 'incubadora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                              machine.status === 'alarm' ? 'bg-red-950/40 border-red-900/50 text-red-400' :
                              machine.status === 'maintenance' ? 'bg-slate-800 border-slate-700 text-slate-500' :
                              'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
                            }`}
                          >
                            <span className="font-bold text-sm">{machine.name}</span>
                            <span className="text-[10px] opacity-80">{machine.temp}°C</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Nacedoras</h3>
                      <div className="grid grid-cols-6 gap-3">
                        {machinesData.filter(m => m.type === 'nacedora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                              machine.status === 'alarm' ? 'bg-red-950/40 border-red-900/50 text-red-400' :
                              machine.status === 'maintenance' ? 'bg-slate-800 border-slate-700 text-slate-500' :
                              'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
                            }`}
                          >
                            <span className="font-bold text-sm">{machine.name}</span>
                            <span className="text-[10px] opacity-80">{machine.temp}°C</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Charts Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity size={20} className="text-blue-500" />
                    Tendencias Climáticas
                  </h2>
                  <div className="relative">
                    <select 
                      value={chartFilter}
                      onChange={(e) => setChartFilter(e.target.value)}
                      className="appearance-none bg-slate-900 border border-slate-700 text-slate-300 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:border-blue-500 text-sm font-medium"
                    >
                      <option>Todas (Promedio)</option>
                      {machinesData.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperatura (°C)" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6 }} />
                      <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humedad (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#0f172a' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

            </div>
          ) : (
            /* Personal Tab */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">Gestión de Personal</h2>
                <p className="text-sm text-slate-400">Administración de turnos y operarios</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Operario</th>
                    <th className="px-6 py-4">Turno Asignado</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {MOCK_OPERATORS.map(op => (
                    <tr key={op.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                          {op.name.charAt(0)}
                        </div>
                        {op.name}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{op.shift}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          op.status === 'Activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-400 hover:text-blue-300 font-medium text-xs uppercase tracking-wider">
                          Modificar Turno
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Machine Detail Modal */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  {selectedMachine.name}
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    selectedMachine.status === 'alarm' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                    selectedMachine.status === 'maintenance' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {selectedMachine.status === 'alarm' ? 'Alarma Activa' : selectedMachine.status === 'maintenance' ? 'Mantenimiento' : 'Operación Normal'}
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">Última actualización: {selectedMachine.lastUpdate}</p>
              </div>
              <button 
                onClick={() => setSelectedMachine(null)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-8">
              
              {/* Data Section */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Parámetros Actuales</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400 mb-1">Temp. Principal</p>
                      <p className="text-xl font-black text-white">{selectedMachine.temp}°C</p>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400 mb-1">Humedad / CO2</p>
                      <p className="text-xl font-black text-white">{selectedMachine.humidity}%</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Observaciones del Operario</h3>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300">
                    {selectedMachine.observaciones || (selectedMachine.status === 'alarm' 
                      ? "Se detectó una ligera variación en la temperatura superior. Se ajustó válvula." 
                      : "Parámetros dentro de rango normal. Sin novedades.")}
                  </div>
                </div>
              </div>

              {/* Evidence Section */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ImageIcon size={16} />
                  Evidencia Fotográfica
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded-xl aspect-[3/4] flex flex-col items-center justify-center text-slate-600 relative overflow-hidden">
                  {selectedMachine.photoUrl ? (
                    <img 
                      src={selectedMachine.photoUrl} 
                      alt="Evidencia" 
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img 
                      src={`https://picsum.photos/seed/${selectedMachine.id}/400/600`} 
                      alt="Evidencia Simulada" 
                      className="absolute inset-0 w-full h-full object-cover opacity-80 grayscale"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-xs text-white/80 font-mono bg-black/50 p-2 rounded backdrop-blur-sm">
                      {new Date().toISOString().replace('T', ' ').substring(0, 19)}<br/>
                      Operario: Juan Pérez
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
