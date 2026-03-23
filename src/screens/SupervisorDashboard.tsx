import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, Clock, Users, LayoutDashboard, 
  Settings, ChevronDown, X, Image as ImageIcon, CheckCircle2,
  Download, Loader2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    try {
      const doc = new jsPDF();
      
      // Header y Logo corporativo (texto figurativo)
      doc.setFontSize(22);
      doc.setTextColor(245, 166, 35); // Naranja Incubant
      doc.setFont("helvetica", "bold");
      doc.text('INCUBANT MONITOR', 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('REPORTE Y CONTROL DIARIO DE MÁQUINAS (INCUBADORAS Y NACEDORAS)', 14, 28);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 14, 35);
      doc.text(`Operario Responsable: Juan Pérez (Supervisor de Turno)`, 14, 40);

      // Preparar datos para las Incubadoras
      const incubadoras = machinesData.filter(m => m.type === 'incubadora');
      const tableDataIncubadoras = incubadoras.map(m => [
        m.name.replace('Incubadora ', ''),
        m.status === 'alarm' ? 'Alarma' : m.status === 'maintenance' ? 'Mantenim.' : 'OK',
        m.data?.diaIncubacion || m.incubatorDay || '--',
        m.data?.tempOvoscan || m.temp || '--',
        m.data?.tempAire || '--',
        m.data?.humedadRelativa || m.humidity || '--',
        m.data?.co2 || '--',
        m.data?.volteoNumero || '--',
        m.data?.volteoPosicion || '--',
        m.data?.alarma || 'No',
        m.data?.observaciones?.substring(0, 30) || ''
      ]);

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text('CONTROL DIARIO INCUBADORAS', 14, 55);

      autoTable(doc, {
        startY: 60,
        head: [['N°', 'Estado', 'Día', 'T.Ovo', 'T.Aire', 'Hum %', 'CO2', 'V/N°', 'V/Pos', 'Alarma', 'Observaciones']],
        body: tableDataIncubadoras,
        theme: 'grid',
        headStyles: { fillColor: [245, 166, 35], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      // Preparar datos para las Nacedoras
      const currentY = (doc as any).lastAutoTable.finalY + 15;
      const nacedoras = machinesData.filter(m => m.type === 'nacedora');
      const tableDataNacedoras = nacedoras.map(m => [
        m.name.replace('Nacedora ', ''),
        m.status === 'alarm' ? 'Alarma' : m.status === 'maintenance' ? 'Mantenim.' : 'OK',
        m.data?.diaIncubacion || m.incubatorDay || '--',
        m.data?.temperatura || m.temp || '--',
        m.data?.humedadRelativa || m.humidity || '--',
        m.data?.co2 || '--',
        m.data?.observaciones?.substring(0, 40) || ''
      ]);

      // Comprobar si hay espacio para las nacedoras, o crear nueva página
      if (currentY > 250) {
        doc.addPage();
        doc.text('CONTROL DIARIO NACEDORAS', 14, 20);
        autoTable(doc, {
          startY: 25,
          head: [['N°', 'Estado', 'Día Inc.', 'Temp °C', 'Hum %', 'CO2', 'Observaciones']],
          body: tableDataNacedoras,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 2 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      } else {
        doc.text('CONTROL DIARIO NACEDORAS', 14, currentY);
        autoTable(doc, {
          startY: currentY + 5,
          head: [['N°', 'Estado', 'Día Inc.', 'Temp °C', 'Hum %', 'CO2', 'Observaciones']],
          body: tableDataNacedoras,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100], textColor: 255, fontSize: 8, fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 2 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      // Pie de página
      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Documento Confidencial - Incubant © ${new Date().getFullYear()} | Página ${i} de ${pageCount}`, 14, 290);
      }

      // Forzar la descarga en el cliente
      doc.save(`Control_Diario_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al compilar el documento. Verifica si hay datos disponibles.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-white text-brand-gray items-center justify-center flex-col gap-6">
        <Loader2 size={64} className="text-brand-primary animate-spin" />
        <p className="text-xl font-bold animate-pulse text-brand-dark">Conectando con Planta de Incubación...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-brand-dark font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col shadow-xl z-20">
        <div className="p-8 flex flex-col items-center gap-4 border-b border-gray-50 bg-brand-secondary/5">
          <img src="/logo.png" alt="Incubant Logo" className="w-48 h-auto" />
          <div className="text-center px-4 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
            <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em]">Sistema de Monitoreo</p>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-3">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-bold tracking-tight">Panel Control</span>
          </button>
          <button 
            onClick={() => setActiveTab('personal')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'personal' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <Users size={20} />
            <span className="font-bold tracking-tight">Personal Planta</span>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-50">
          <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-gray-50 text-brand-gray font-semibold transition-all">
            <Settings size={20} />
            <span className="font-bold tracking-tight">Configuración</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
           {/* Top Bar - KPIs */}
        <header className="h-24 bg-white border-b border-gray-100 flex items-center justify-between px-10 shrink-0 z-10">
          
          {/* Operario Info */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 shadow-inner">
                <Users size={24} className="text-brand-primary" />
              </div>
              <div>
                <p className="text-[10px] text-brand-gray font-black uppercase tracking-widest">Supervisor de Turno</p>
                <p className="text-base font-black text-brand-dark">Juan Pérez</p>
              </div>
            </div>
            
            <div className="w-56">
              <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-widest">
                <span className="text-brand-gray">Eficiencia de Planta</span>
                <span className="text-brand-primary">80%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-brand-primary w-4/5 rounded-full shadow-[0_0_10px_rgba(245,166,35,0.5)]"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDownloadReport}
              className="bg-brand-primary hover:bg-[#E6951F] text-white px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-black transition-all shadow-xl shadow-brand-primary/20 active:scale-95 uppercase tracking-widest"
            >
              <Download size={20} />
              Reporte PDF
            </button>

            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3 flex items-center gap-4">
              <div className="p-2 bg-green-50 rounded-xl">
                <CheckCircle2 className="text-green-500" size={20} />
              </div>
              <div>
                <p className="text-[9px] text-brand-gray uppercase font-black tracking-widest">Reportes</p>
                <p className="text-xl font-black text-brand-dark leading-none">142</p>
              </div>
            </div>

            <div className={`border shadow-sm rounded-2xl px-5 py-3 flex items-center gap-4 transition-colors ${
              activeAlarms > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'
            }`}>
              <div className={`p-2 rounded-xl ${activeAlarms > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <AlertTriangle className={activeAlarms > 0 ? 'text-red-500' : 'text-brand-gray'} size={20} />
              </div>
              <div>
                <p className="text-[9px] text-brand-gray uppercase font-black tracking-widest">Alarmas</p>
                <p className={`text-xl font-black leading-none ${activeAlarms > 0 ? 'text-red-600' : 'text-brand-dark'}`}>
                  {activeAlarms}
                </p>
              </div>
            </div>

            <div className="bg-brand-secondary/10 border border-brand-secondary/30 rounded-2xl px-5 py-3 flex items-center gap-4 animate-pulse">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Clock className="text-brand-primary" size={20} />
              </div>
              <div>
                <p className="text-[9px] text-brand-primary uppercase font-black tracking-widest">Cambio</p>
                <p className="text-xl font-black text-brand-primary leading-none">14:00</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-10 bg-gray-50/30">
          {activeTab === 'dashboard' ? (
            <div className="space-y-10">
              
              {/* Heatmap Section */}
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                  <h2 className="text-xl font-black text-brand-dark flex items-center gap-3">
                    Mapa de Planta en Tiempo Real
                  </h2>
                </div>
                
                <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
                  <div className="mb-6 flex gap-6 text-[10px] font-black uppercase tracking-widest text-brand-gray">
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100"><span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span> Operación OK</div>
                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100"><span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span> Alarma Crítica</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-300"></span> Fuera de Línea</div>
                  </div>

                  <div className="space-y-10">
                    <div>
                      <h3 className="text-xs font-black text-brand-gray uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-60">
                        <div className="w-4 h-[2px] bg-brand-primary"></div>
                        Incubadoras (Planta A)
                      </h3>
                      <div className="grid grid-cols-8 gap-4">
                        {machinesData.filter(m => m.type === 'incubadora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-110 active:scale-95 shadow-sm ${
                              machine.status === 'alarm' ? 'bg-red-50 border-red-500/50 text-red-600' :
                              machine.status === 'maintenance' ? 'bg-gray-50 border-gray-200 text-gray-400' :
                              'bg-white border-brand-primary/10 hover:border-brand-primary text-brand-dark'
                            }`}
                          >
                            <span className="font-black text-xs">{machine.name.replace('Incubadora ', '')}</span>
                            <span className={`text-[10px] font-bold ${machine.status === 'alarm' ? 'text-red-500' : 'text-brand-primary'}`}>{machine.temp}°C</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-black text-brand-gray uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-60">
                        <div className="w-4 h-[2px] bg-brand-primary"></div>
                        Nacedoras (Planta B)
                      </h3>
                      <div className="grid grid-cols-6 gap-4">
                        {machinesData.filter(m => m.type === 'nacedora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-110 active:scale-95 shadow-sm ${
                              machine.status === 'alarm' ? 'bg-red-50 border-red-500/50 text-red-600' :
                              machine.status === 'maintenance' ? 'bg-gray-50 border-gray-200 text-gray-400' :
                              'bg-white border-brand-primary/10 hover:border-brand-primary text-brand-dark'
                            }`}
                          >
                            <span className="font-black text-xs">{machine.name.replace('Nacedora ', '')}</span>
                            <span className={`text-[10px] font-bold ${machine.status === 'alarm' ? 'text-red-500' : 'text-brand-primary'}`}>{machine.temp}°C</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Charts Section */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                    <h2 className="text-xl font-black text-brand-dark flex items-center gap-3">
                      Tendencias y Analítica
                    </h2>
                  </div>
                  <div className="relative">
                    <select 
                      value={chartFilter}
                      onChange={(e) => setChartFilter(e.target.value)}
                      className="appearance-none bg-white border-2 border-gray-100 text-brand-dark font-bold py-2.5 pl-6 pr-12 rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-sm transition-all shadow-sm"
                    >
                      <option>Ver: Planta Completa</option>
                      {machinesData.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-3xl p-10 h-[450px] shadow-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '600' }} tickLine={false} axisLine={false} dy={10} />
                      <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '600' }} tickLine={false} axisLine={false} dx={-10} />
                      <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '600' }} tickLine={false} axisLine={false} dx={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '16px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '30px', fontSize: '12px', fontWeight: 'bold' }} iconType="circle" />
                      <Line yAxisId="left" type="monotone" dataKey="temp" name="Temperatura (°C)" stroke="#f5a623" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, fill: '#f5a623', stroke: '#fff', strokeWidth: 3 }} />
                      <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humedad (%)" stroke="#ffd05b" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 8, fill: '#ffd05b', stroke: '#fff', strokeWidth: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

            </div>
          ) : (
            /* Personal Tab */
            <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-brand-dark">Gestión de Personal</h2>
                  <p className="text-sm text-brand-gray font-medium">Administración de turnos y operarios en planta</p>
                </div>
                <button className="bg-brand-primary/10 text-brand-primary px-6 py-2.5 rounded-xl text-sm font-black hover:bg-brand-primary hover:text-white transition-all">
                  + Registrar Operario
                </button>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-brand-gray uppercase text-[10px] font-black tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Operario</th>
                    <th className="px-8 py-5">Turno Asignado</th>
                    <th className="px-8 py-5">Estado</th>
                    <th className="px-8 py-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MOCK_OPERATORS.map(op => (
                    <tr key={op.id} className="hover:bg-brand-secondary/5 transition-colors group">
                      <td className="px-8 py-5 font-bold text-brand-dark flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-sm text-brand-primary font-black shadow-inner">
                          {op.name.charAt(0)}
                        </div>
                        {op.name}
                      </td>
                      <td className="px-8 py-5 text-brand-gray font-medium">{op.shift}</td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          op.status === 'Activo' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-gray-100 text-brand-gray border-gray-200'
                        }`}>
                          {op.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="text-brand-primary hover:text-brand-dark font-black text-xs uppercase tracking-widest transition-colors">
                          Modificar
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
        <div className="fixed inset-0 z-50 bg-brand-dark/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white border-2 border-brand-primary/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300">
            
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-brand-secondary/5">
              <div>
                <h2 className="text-3xl font-black text-brand-dark flex items-center gap-4">
                  {selectedMachine.name}
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${
                    selectedMachine.status === 'alarm' ? 'bg-red-50 text-red-600 border-red-100' :
                    selectedMachine.status === 'maintenance' ? 'bg-gray-100 text-brand-gray border-gray-200' :
                    'bg-green-50 text-green-600 border-green-100'
                  }`}>
                    {selectedMachine.status === 'alarm' ? 'Alarma Detectada' : selectedMachine.status === 'maintenance' ? 'Mantenimiento' : 'Estado Óptimo'}
                  </span>
                </h2>
                <p className="text-sm text-brand-gray font-bold mt-2 uppercase tracking-widest opacity-60">Sincronizado: {selectedMachine.lastUpdate}</p>
              </div>
              <button 
                onClick={() => setSelectedMachine(null)}
                className="p-3 bg-white hover:bg-gray-50 rounded-2xl text-brand-gray transition-all shadow-sm border border-gray-100"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 grid grid-cols-2 gap-10">
              
              {/* Data Section */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] font-black text-brand-gray uppercase tracking-[0.3em] mb-4 opacity-50">Parámetros Críticos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 shadow-inner">
                      <p className="text-[10px] font-bold text-brand-gray mb-1 uppercase tracking-widest">Temperatura</p>
                      <p className="text-2xl font-black text-brand-primary">
                        {selectedMachine.data?.temperatura || selectedMachine.temp || '--'}°C
                      </p>
                    </div>
                    <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 shadow-inner">
                      <p className="text-[10px] font-bold text-brand-gray mb-1 uppercase tracking-widest">Humedad</p>
                      <p className="text-2xl font-black text-brand-primary">
                        {selectedMachine.data?.humedad || selectedMachine.humidity || '--'}%
                      </p>
                    </div>
                    <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 shadow-inner">
                      <p className="text-[10px] font-bold text-brand-gray mb-1 uppercase tracking-widest">Día</p>
                      <p className="text-2xl font-black text-brand-primary">
                        {selectedMachine.data?.diaIncubacion || '--'}
                      </p>
                    </div>
                    {selectedMachine.type === 'incubadora' && (
                      <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 shadow-inner">
                        <p className="text-[10px] font-bold text-brand-gray mb-1 uppercase tracking-widest">Volteos</p>
                        <p className="text-2xl font-black text-brand-primary">
                          {selectedMachine.data?.numeroVolteos || '--'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-brand-gray uppercase tracking-[0.3em] mb-4 opacity-50">Bitácora de Operario</h3>
                  <div className="bg-brand-secondary/5 p-6 rounded-3xl border border-brand-secondary/20 text-sm text-brand-dark font-medium leading-relaxed italic">
                    "{selectedMachine.observaciones || (selectedMachine.status === 'alarm' 
                      ? "Variación térmica fuera de rango. Requiere inspección inmediata." 
                      : "Operación estable. Sin requerimientos especiales.")}"
                  </div>
                </div>
              </div>

              {/* Evidence Section */}
              <div>
                <h3 className="text-[10px] font-black text-brand-gray uppercase tracking-[0.3em] mb-4 opacity-50 flex items-center gap-2">
                  <ImageIcon size={14} className="text-brand-primary" />
                  Registro Visual
                </h3>
                <div className="bg-gray-100 border-2 border-dashed border-gray-200 rounded-[2rem] aspect-[3/4] flex flex-col items-center justify-center text-slate-600 relative overflow-hidden shadow-inner">
                  {selectedMachine.photoUrl ? (
                    <img 
                      src={selectedMachine.photoUrl} 
                      alt="Evidencia" 
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <img 
                      src={`https://picsum.photos/seed/${selectedMachine.id}/400/600`} 
                      alt="Evidencia Simulada" 
                      className="absolute inset-0 w-full h-full object-cover grayscale opacity-50"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-6 left-6 right-6">
                    <p className="text-[10px] text-white font-black uppercase tracking-widest bg-brand-primary/80 py-2 px-3 rounded-lg backdrop-blur-md inline-block">
                      {new Date().toISOString().substring(0, 10)} | Juan Pérez
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
