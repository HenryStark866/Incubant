import React, { useState, useEffect } from 'react';
import { 
  Activity, AlertTriangle, Clock, Users, LayoutDashboard, 
  Settings, ChevronDown, X, Image as ImageIcon, CheckCircle2,
  Download, Loader2, Egg, Menu, RefreshCw, LogOut
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMachineStore } from '../store/useMachineStore';
import { listEvidences } from '../lib/supabase';
import { getApiUrl, apiFetch } from '../lib/api';

import ShiftManager from '../components/Admin/ShiftManager';

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal' | 'horarios' | 'settings'>('dashboard');
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [chartFilter, setChartFilter] = useState('Ver: Planta Completa');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [machinesData, setMachinesData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [operatorsData, setOperatorsData] = useState<any[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [summaryData, setSummaryData] = useState<{
    lastReportTime: string | null;
    activeOperatorsCount: number;
    activeOperatorsNames: string;
    currentShift: string;
  }>({ lastReportTime: null, activeOperatorsCount: 0, activeOperatorsNames: 'N/A', currentShift: 'Turno 1' });
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
    // Modal states
  const [showCreateOperator, setShowCreateOperator] = useState(false);
  const [isCreatingOperator, setIsCreatingOperator] = useState(false);
  const [newOperator, setNewOperator] = useState({
    name: '',
    pin: '',
    role: 'OPERARIO',
    turno: 'Turno 1',
  });

  const [editingOperator, setEditingOperator] = useState<any | null>(null);
  const [isUpdatingOperator, setIsUpdatingOperator] = useState(false);

  const [showEvidencesModal, setShowEvidencesModal] = useState(false);
  const [evidencesList, setEvidencesList] = useState<any[]>([]);
  const [isLoadingEvidences, setIsLoadingEvidences] = useState(false);
  
  const currentUser = useMachineStore(state => state.currentUser);
  const logout = useMachineStore(state => state.logout);
  const resetHourlyStatus = useMachineStore(state => state.resetHourlyStatus);
  const canAccessSupervisor = currentUser?.role === 'JEFE' || currentUser?.role === 'SUPERVISOR';

  // Request notification permissions for admin alerts
  useEffect(() => {
    if (canAccessSupervisor && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [canAccessSupervisor]);

  // Alerta inmediata de Nuevo Reporte a los administradores
  const [previousReportCount, setPreviousReportCount] = useState<number | null>(null);

  useEffect(() => {
    if (previousReportCount !== null && reportCount > previousReportCount) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('¡Incubant: Nuevo Reporte!', {
          body: `Un operario acaba de sincronizar datos de su rutina.`,
          icon: '/pwa-192x192.png'
        });
      }
    }
    setPreviousReportCount(reportCount);
  }, [reportCount]);

  // Reloj y reglas de turno en tiempo real
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // REEMPLAZADO POR DATOS DE API: El nombre del turno y operarios ahora se obtienen de la tabla de asignaciones
  const currentShiftName = summaryData.currentShift;
  const activeOperatorsList = summaryData.activeOperatorsNames;

  const handleTabChange = (tab: 'dashboard' | 'personal' | 'horarios' | 'settings') => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch(getApiUrl('/api/logout'), { method: 'POST' });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    } finally {
      logout();
    }
  };

  const handleOpenEvidences = async () => {
    setShowEvidencesModal(true);
    setIsLoadingEvidences(true);
    const files = await listEvidences('reportes');
    setEvidencesList(files);
    setIsLoadingEvidences(false);
  };

  const handleResetLocalData = () => {
    resetHourlyStatus();
    alert('Se reiniciaron las revisiones locales del dispositivo.');
  };

  const handleCreateOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar PIN
    if (newOperator.pin.length !== 4 || !/^\d+$/.test(newOperator.pin)) {
      alert('El PIN debe ser exactamente 4 dígitos numéricos');
      return;
    }

    setIsCreatingOperator(true);
    try {
      const response = await apiFetch(getApiUrl('/api/operators'), {
        method: 'POST',
        body: JSON.stringify({
          nombre: newOperator.name,
          pin: newOperator.pin,
          rol: newOperator.role,
        }),
      });

      if (response.ok) {
        const createdOperator = await response.json();
        // Actualizar la lista de operadores
        setOperatorsData(prev => [...prev, createdOperator]);
        // Reset form
        setNewOperator({ name: '', pin: '', role: 'OPERARIO', turno: 'Turno 1' });
        setShowCreateOperator(false);
        alert('Operario creado exitosamente');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error creating operator:', error);
      alert('Error de conexión. Por favor intente nuevamente.');
    } finally {
      setIsCreatingOperator(false);
    }
  };

  const handleUpdateOperatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator) return;

    setIsUpdatingOperator(true);
    try {
      const response = await apiFetch(getApiUrl(`/api/operators/${editingOperator.id}`), {
        method: 'PUT',
        body: JSON.stringify({
          turno: editingOperator.shift,
          estado: editingOperator.status,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setOperatorsData(prev => prev.map(op => op.id === updated.id ? updated : op));
        setEditingOperator(null);
        alert('Operario actualizado exitosamente');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Error updating operator:', error);
      alert('Error de conexión. Por favor intente nuevamente.');
    } finally {
      setIsUpdatingOperator(false);
    }
  };

  const handleDeleteOperator = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este operario? Si tiene registros asociados, se desactivará en lugar de borrarse.')) return;
    
    try {
      const response = await apiFetch(getApiUrl(`/api/operators/${id}`), {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setOperatorsData(prev => prev.filter(op => op.id !== id));
      } else {
        const err = await response.json();
        alert(err.error || 'Error eliminando el usuario.');
      }
    } catch (error) {
      alert('Error de conexión a la Base de Datos.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!canAccessSupervisor) {
        setIsLoading(false);
        return;
      }
      
      try {
        const [statusRes, trendsRes, operatorsRes, summaryRes] = await Promise.all([
          apiFetch(getApiUrl('/api/dashboard/status')),
          apiFetch(getApiUrl('/api/dashboard/trends')),
          apiFetch(getApiUrl('/api/dashboard/operators')),
          apiFetch(getApiUrl('/api/dashboard/summary'))
        ]);
        
        const statusJson = await statusRes.json();
        const trendsJson = await trendsRes.json();
        const operatorsJson = await operatorsRes.json();
        const summaryJson = await summaryRes.json();
        
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

        if (operatorsRes.ok && Array.isArray(operatorsJson)) {
          setOperatorsData(operatorsJson);
        } else {
          setOperatorsData([]);
          if (operatorsJson?.error) setDbError(operatorsJson.error);
        }

        if (summaryRes.ok && summaryJson) {
          setSummaryData(prev => ({ 
            ...prev, 
            ...summaryJson,
            // Aseguramos que los campos requeridos tengan un valor base
            activeOperatorsNames: summaryJson.activeOperatorsNames || 'N/A',
            currentShift: summaryJson.currentShift || prev.currentShift || 'Turno actual'
          }));
          setReportCount(summaryJson.reportCount || 0);
        } else {
          setReportCount(0);
        }

        // Reset error if success
        setDbError(null);
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        setDbError(error.message?.includes('JSON') 
          ? "Error de formato en la respuesta del servidor." 
          : "No fue posible conectar con la Base de Datos. Revisa DATABASE_URL en Vercel.");
        setMachinesData([]);
        setTrendsData([]);
        setOperatorsData([]);
        setReportCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
    const interval = setInterval(() => fetchData(), 60000);
    return () => clearInterval(interval);
  }, [canAccessSupervisor]);

  useEffect(() => {
    if (canAccessSupervisor) {
      const fetchData = async () => {
        try {
          const trendsRes = await apiFetch(getApiUrl(`/api/dashboard/trends?machine=${encodeURIComponent(chartFilter)}`));
          const trendsJson = await trendsRes.json();
          if (trendsRes.ok && Array.isArray(trendsJson)) {
            setTrendsData(trendsJson);
          } else {
            setTrendsData([]);
          }
        } catch (error) {
          setTrendsData([]);
        }
      };
      void fetchData();
    }
  }, [chartFilter]);

  const activeAlarms = machinesData.filter(m => m.status === 'alarm').length;
  const efficiency = machinesData.length > 0
    ? Math.round((machinesData.filter(m => m.status === 'ok').length / machinesData.length) * 100)
    : 0;

  const handleDownloadReport = async () => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      
      // Header y Logo corporativo
      doc.setFillColor(245, 166, 35); // Naranja Incubant
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text('INCUBANT MONITOR', 14, 20);
      
      doc.setFontSize(10);
      doc.text('V0.1.0 "Incubant Integral" | MINUTA DE TURNO', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha y Hora de Cierre: ${timestamp}`, 14, 50);
      doc.text(`Supervisor Responsable: ${currentUser?.name || 'Sistema'}`, 14, 55);
      doc.text(`Turno Operativo: ${summaryData.currentShift}`, 14, 60);

      // Preparar datos para las Incubadoras
      const tableDataIncubadoras = machinesData
        .filter(m => m.type === 'incubadora')
        .map(m => {
          const d = m.data;
          return [
            m.name.replace('INC-', ''),
            m.status === 'alarm' ? 'ALARMA' : 'OK',
            d?.tempOvoscan || m.temp || '--',
            d?.tempAire || '--',
            d?.humedadRelativa || '--',
            d?.co2 || '--',
            d?.volteoNumero || '--',
            d?.ventiladorPrincipal || '--'
          ];
        });

      doc.setFontSize(14);
      doc.setTextColor(245, 166, 35);
      doc.setFont("helvetica", "bold");
      doc.text('DATOS TÉCNICOS: INCUBADORAS', 14, 75);

      autoTable(doc, {
        startY: 80,
        head: [['Máquina', 'Estado', 'T.Ovo', 'T.Aire', 'Hum %', 'CO2', 'V/N°', 'Vent']],
        body: tableDataIncubadoras,
        theme: 'striped',
        headStyles: { fillColor: [245, 166, 35], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Preparar datos para las Nacedoras
      const lastY = (doc as any).lastAutoTable.finalY + 15;
      const tableDataNacedoras = machinesData
        .filter(m => m.type === 'nacedora')
        .map(m => {
          const d = m.data;
          return [
            m.name.replace('NAC-', ''),
            m.status === 'alarm' ? 'ALARMA' : 'OK',
            d?.temperatura || m.temp || '--',
            d?.humedadRelativa || '--',
            d?.co2 || '--',
            d?.ventiladorPrincipal || '--'
          ];
        });

      doc.text('DATOS TÉCNICOS: NACEDORAS', 14, lastY);
      autoTable(doc, {
        startY: lastY + 5,
        head: [['Máquina', 'Estado', 'Temp °C', 'Hum %', 'CO2', 'Vent']],
        body: tableDataNacedoras,
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8 }
      });

      // Seccion de Alarmas e Incidentes (Minuta Integrada)
      const incidentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setTextColor(245, 166, 35);
      doc.text('BITÁCORA DE INCIDENTES Y ALARMAS', 14, incidentY);
      
      try {
        const incRes = await apiFetch(getApiUrl('/api/dashboard/incidents?limit=15'));
        const incidents = await incRes.json();
        
        if (incidents.length > 0) {
          const body = incidents.map((inc: any) => [
            new Date(inc.fecha_hora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            inc.titulo,
            inc.descripcion
          ]);
          autoTable(doc, {
            startY: incidentY + 5,
            head: [['Hora', 'Incidente', 'Descripción']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [239, 68, 68] },
            styles: { fontSize: 7 }
          });
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.text('No se registraron alarmas manuales o incidentes críticos en este turno.', 14, incidentY + 10);
        }
      } catch (err) {
        doc.text('Fallo al conectar con la bitácora de incidentes.', 14, incidentY + 10);
      }

      // Footer con Enlace a Evidencias
      const footerY = 285;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Este documento es una copia electrónica generada automáticamente por Incubant Monitor v0.1.0', 14, footerY - 10);
      
      doc.setTextColor(0, 0, 255);
      doc.textWithLink('>>> VER EVIDENCIAS FOTOGRÁFICAS EN LA NUBE <<<', 14, footerY, { url: window.location.origin });
      
      doc.save(`Minuta_Incubant_${new Date().toISOString().split('T')[0]}_Turno.pdf`);
    } catch (error) {
      console.error('Error al generar PDF:', error);
      alert('Error al compilar el reporte integral.');
    }
  };

  if (dbError) {
    return (
      <div className="flex h-screen bg-gray-50 text-red-600 items-center justify-center p-8 flex-col text-center gap-4">
        <AlertTriangle size={48} className="mb-4" />
        <h2 className="text-2xl font-black text-brand-dark">Fallo de Comunicación</h2>
        <p className="max-w-md text-brand-gray font-medium">{dbError}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-8 py-3 bg-brand-primary text-white font-bold rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-105 transition-all"
        >
          Reintentar Conexión
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-white text-brand-gray items-center justify-center flex-col gap-6">
        <Loader2 size={64} className="text-brand-primary animate-spin" />
        <p className="text-xl font-bold animate-pulse text-brand-dark tracking-tight">Cargando Monitor...</p>
      </div>
    );
  }

  if (!canAccessSupervisor) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-3xl shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <h1 className="text-2xl font-black text-brand-dark mb-2">Acceso restringido</h1>
          <p className="text-sm text-brand-gray font-medium">
            El panel administrativo solo está disponible para usuarios autenticados con rol de jefe o supervisor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen bg-gray-50 text-brand-dark font-sans overflow-hidden">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-brand-dark/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 flex flex-col shadow-xl transform transition-transform duration-300 lg:static lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-6 sm:p-8 flex flex-col items-center gap-4 border-b border-gray-50 bg-brand-secondary/5">
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-brand-primary p-2 rounded-xl text-white shadow-md">
                <Egg size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black text-brand-dark tracking-tight leading-none">INCUBANT</span>
                <span className="text-[0.5rem] font-bold text-brand-gray tracking-widest uppercase mt-0.5">Antioqueña de Incubación S.A.S.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 rounded-xl bg-white border border-gray-100 text-brand-gray"
            >
              <X size={18} />
            </button>
          </div>
          <div className="text-center px-4 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
            <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em]">Sistema de Monitoreo</p>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          <button 
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-bold tracking-tight">Panel Control</span>
          </button>
          <button 
            onClick={() => handleTabChange('personal')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'personal' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <Users size={20} />
            <span className="font-bold tracking-tight">Personal Planta</span>
          </button>
          <button 
            onClick={() => handleTabChange('horarios')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'horarios' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <Clock size={20} />
            <span className="font-bold tracking-tight">Horarios</span>
          </button>

          {/* SECCIÓN DE ALMACENAMIENTO CLOUD */}
          <div className="pt-4 mt-4 border-t border-gray-100 flex flex-col gap-2">
            <p className="px-2 text-[10px] text-brand-gray font-black uppercase tracking-[0.2em] opacity-60 mb-2">Bóveda de Evidencia</p>
            
            <a 
              href="https://drive.google.com/drive/folders/1LSI9hpfQiYD0w0U79Noh6tI1BDgnHwqn?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-brand-gray hover:bg-brand-primary/10 hover:text-brand-primary transition-all font-bold text-xs group"
            >
              <Camera size={18} className="group-hover:scale-110 transition-transform" />
              <span>Fotos Planta</span>
            </a>
            
            <a 
              href="https://drive.google.com/drive/folders/15NhdznwFJycDOFsQs9dZwTS6vR_srfXi?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-brand-gray hover:bg-brand-primary/10 hover:text-brand-primary transition-all font-bold text-xs group"
            >
              <FileText size={18} className="group-hover:scale-110 transition-transform" />
              <span>Informes Por Hora</span>
            </a>
            
            <a 
              href="https://drive.google.com/drive/folders/1tI5ROHJ_RxeSWE2Q38BXxAVk82TYrdtG?usp=sharing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-brand-gray hover:bg-brand-primary/10 hover:text-brand-primary transition-all font-bold text-xs group"
            >
              <FolderOpen size={18} className="group-hover:scale-110 transition-transform" />
              <span>Cierres de Turno</span>
            </a>
          </div>
        </nav>


        <div className="p-6 border-t border-gray-50">
          <button
            onClick={() => handleTabChange('settings')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${
              activeTab === 'settings' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : 'hover:bg-gray-50 text-brand-gray font-semibold'
            }`}
          >
            <Settings size={20} />
            <span className="font-bold tracking-tight">Configuración</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {showCreateOperator && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            id="createOperatorModal"
            onClick={() => setShowCreateOperator(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl transform transition-all duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-black text-brand-dark">Registrar Nuevo Operario</h2>
                <button onClick={() => setShowCreateOperator(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCreateOperatorSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-brand-gray mb-2">Nombre Completo</label>
                  <input 
                    type="text"
                    value={newOperator.name}
                    onChange={(e) => setNewOperator({...newOperator, name: e.target.value})}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-brand-gray mb-2">PIN de Acceso (4 dígitos)</label>
                   <input 
                    type="password"
                    value={newOperator.pin}
                    onChange={(e) => setNewOperator({...newOperator, pin: e.target.value})}
                    maxLength={4}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-brand-gray mb-2">Rol</label>
                  <select 
                    value={newOperator.role}
                    onChange={(e) => setNewOperator({...newOperator, role: e.target.value})}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  >
                    <option value="">Seleccione un rol</option>
                    <option value="OPERARIO">Operario</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="JEFE">Jefe / Administrador</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => setShowCreateOperator(false)}
                    className="px-5 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreatingOperator}
                    className={`px-5 py-3 bg-brand-primary text-white rounded-lg hover:bg-[#E6951F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    {isCreatingOperator ? 'Creando...' : 'Crear Operario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingOperator && (
          <div
            className="fixed inset-0 z-[60] bg-brand-dark/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={() => setEditingOperator(null)}
          >
            <div
              className="bg-white border-2 border-brand-primary/10 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-brand-secondary/5">
                <h2 className="text-xl font-black text-brand-dark">Modificar Operario</h2>
                <button 
                  onClick={() => setEditingOperator(null)}
                  className="p-2 bg-white hover:bg-gray-50 rounded-xl text-brand-gray transition-all shadow-sm border border-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateOperatorSubmit} className="p-6 sm:p-8 space-y-6">
                <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 italic text-sm text-brand-gray">
                  Editando perfil de: <span className="font-black text-brand-dark not-italic ml-1">{editingOperator.name}</span>
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-3 ml-2">Asignar Turno / Horario</label>
                  <div className="relative">
                    <select 
                      value={editingOperator.shift}
                      onChange={(e) => setEditingOperator({...editingOperator, shift: e.target.value})}
                      className="appearance-none w-full px-6 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-brand-dark font-bold text-sm transition-all shadow-sm"
                    >
                      <option value="Turno 1">Turno 1 (Mañana)</option>
                      <option value="Turno 2">Turno 2 (Tarde)</option>
                      <option value="Turno 3">Turno 3 (Noche)</option>
                      <option value="Gestión">Gestión Administrativa</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-3 ml-2">Estado del Operario</label>
                  <div className="relative">
                    <select 
                      value={editingOperator.status}
                      onChange={(e) => setEditingOperator({...editingOperator, status: e.target.value})}
                      className="appearance-none w-full px-6 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-brand-dark font-bold text-sm transition-all shadow-sm"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo / Suspendido</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingOperator(null)}
                    className="flex-1 px-5 py-4 border-2 border-gray-100 rounded-2xl text-brand-gray font-black hover:bg-gray-50 transition-all text-sm uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdatingOperator}
                    className="flex-1 px-5 py-4 bg-brand-primary text-white rounded-2xl font-black hover:bg-[#E6951F] shadow-lg shadow-brand-primary/20 disabled:opacity-50 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {isUpdatingOperator && <Loader2 size={16} className="animate-spin" />}
                    {isUpdatingOperator ? 'Guardando' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEvidencesModal && (
          <div className="fixed inset-0 z-[70] bg-brand-dark/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowEvidencesModal(false)}>
            <div className="bg-white border-2 border-brand-primary/10 rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-brand-secondary/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shadow-sm">
                    <ImageIcon size={24} />
                  </div>
                  <h2 className="text-xl font-black text-brand-dark">Bóveda de Evidencias en Nube</h2>
                </div>
                <button onClick={() => setShowEvidencesModal(false)} className="p-2 hover:bg-white rounded-xl text-brand-gray transition-colors border border-transparent hover:border-gray-100 shadow-sm">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                {isLoadingEvidences ? (
                  <div className="flex flex-col items-center justify-center py-12">
                     <Loader2 size={40} className="text-brand-primary animate-spin mb-4" />
                     <p className="font-bold text-brand-gray">Cargando evidencias seguras...</p>
                     <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Conectando a Supabase Storage</p>
                  </div>
                ) : evidencesList.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <ImageIcon size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="font-bold text-brand-dark">No hay documentos en la bóveda</p>
                    <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Los reportes PDF se agregarán aquí autómaticamente</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {evidencesList.map((file, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-brand-primary/30 hover:shadow-md transition-all">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="p-2 bg-red-50 text-red-500 rounded-xl">
                            <Download size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-brand-dark text-sm truncate">{file.name}</p>
                            <p className="text-[10px] font-black text-brand-gray uppercase tracking-widest mt-1">
                              {new Date(file.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <a 
                          href={file.publicUrl} target="_blank" rel="noopener noreferrer"
                          className="w-full py-3 bg-[#F5F5F7] text-brand-dark hover:bg-brand-primary hover:text-white text-xs font-black uppercase tracking-widest text-center rounded-xl transition-all"
                        >
                          Ver y Descargar
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-10 py-4 shrink-0 z-10">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-8">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-3 rounded-2xl bg-gray-50 border border-gray-100 text-brand-dark"
                >
                  <Menu size={20} />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 shadow-inner">
                    <Users size={24} className="text-brand-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-gray font-black uppercase tracking-widest">Supervisor de Turno</p>
                    <p className="text-base font-black text-brand-dark">{currentUser?.name || 'Sin responsable autenticado'}</p>
                  </div>
                </div>

                <div className="hidden md:block w-56">
                  <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-widest">
                    <span className="text-brand-gray">Eficiencia de Planta</span>
                    <span className="text-brand-primary">{efficiency}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-brand-primary rounded-full shadow-[0_0_10px_rgba(245,166,35,0.5)] transition-all"
                      style={{ width: `${efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleOpenEvidences}
                  className="lg:hidden bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-black transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest"
                >
                  <ImageIcon size={18} />
                  Bóveda
                </button>
                <button
                  onClick={handleDownloadReport}
                  className="lg:hidden bg-brand-primary hover:bg-[#E6951F] text-white px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-black transition-all shadow-xl shadow-brand-primary/20 uppercase tracking-widest"
                >
                  <Download size={18} />
                  PDF
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-stretch gap-3 sm:gap-4">
              <button 
                onClick={handleOpenEvidences}
                className="hidden lg:flex bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl items-center gap-3 text-sm font-black transition-all shadow-xl shadow-blue-600/20 active:scale-95 uppercase tracking-widest"
              >
                <ImageIcon size={20} />
                Ver Evidencias
              </button>

              <button 
                onClick={handleDownloadReport}
                className="hidden lg:flex bg-brand-primary hover:bg-[#E6951F] text-white px-6 py-3 rounded-2xl items-center gap-3 text-sm font-black transition-all shadow-xl shadow-brand-primary/20 active:scale-95 uppercase tracking-widest"
              >
                <Download size={20} />
                Reporte PDF
              </button>

              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3 flex items-center gap-4 min-w-[138px]">
                <div className="p-2 bg-green-50 rounded-xl">
                  <CheckCircle2 className="text-green-500" size={20} />
                </div>
                <div>
                  <p className="text-[9px] text-brand-gray uppercase font-black tracking-widest">Reportes</p>
                  <p className="text-xl font-black text-brand-dark leading-none">{reportCount}</p>
                </div>
              </div>

              <div className={`border shadow-sm rounded-2xl px-5 py-3 flex items-center gap-4 min-w-[138px] transition-colors ${
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

              {/* CARD ÚNICA: MONITOR DE TURNO INTEGRADO */}
              <div className="bg-white border-2 border-brand-primary/20 shadow-lg shadow-brand-primary/5 rounded-3xl px-6 py-4 flex items-center gap-6 min-w-[320px] hover:border-brand-primary/40 transition-all group">
                <div className="relative">
                  <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary shadow-inner group-hover:bg-brand-primary group-hover:text-white transition-colors duration-500">
                    <Clock size={24} className="animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em] leading-none">
                      {currentShiftName} | {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-[10px] font-black text-green-600 rounded-full border border-green-100 uppercase tracking-tighter">
                      En línea
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="text-base font-black text-brand-dark tracking-tight truncate max-w-[200px]">
                      Operador: <span className="text-brand-primary">{activeOperatorsList}</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 opacity-80">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <p className="text-[9px] text-brand-gray font-black uppercase tracking-tight">
                        Ult. Reporte: {summaryData.lastReportTime ? new Date(summaryData.lastReportTime).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </p>
                      </div>
                      <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                      <p className="text-[9px] text-brand-gray font-black uppercase tracking-tight">
                        {currentTime.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-10 bg-gray-50/30">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 lg:space-y-10">
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                  <h2 className="text-xl font-black text-brand-dark flex items-center gap-3">
                    Mapa de Planta en Tiempo Real
                  </h2>
                </div>
                
                <div className="bg-white border border-gray-100 rounded-3xl p-5 sm:p-8 shadow-sm">
                  <div className="mb-6 flex flex-wrap gap-4 sm:gap-6 text-[10px] font-black uppercase tracking-widest text-brand-gray">
                    <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-gray-100"><span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span> Operación OK</div>
                    <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-gray-100"><span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span> Alarma Crítica</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-300"></span> Fuera de Línea</div>
                  </div>

                  <div className="space-y-8 sm:space-y-10">
                    <div>
                      <h3 className="text-xs font-black text-brand-gray uppercase tracking-[0.2em] mb-4 flex items-center gap-2 opacity-60">
                        <div className="w-4 h-[2px] bg-brand-primary"></div>
                        Incubadoras (Planta A)
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
                        {machinesData.filter(m => m.type === 'incubadora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 shadow-sm ${
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                        {machinesData.filter(m => m.type === 'nacedora').map(machine => (
                          <button
                            key={machine.id}
                            onClick={() => setSelectedMachine(machine)}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 shadow-sm ${
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

              <section>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                    <h2 className="text-xl font-black text-brand-dark flex items-center gap-3">
                      Tendencias y Analítica
                    </h2>
                  </div>
                  <div className="relative w-full sm:w-auto">
                    <select 
                      value={chartFilter}
                      onChange={(e) => setChartFilter(e.target.value)}
                      className="appearance-none w-full bg-white border-2 border-gray-100 text-brand-dark font-bold py-2.5 pl-6 pr-12 rounded-2xl focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-sm transition-all shadow-sm"
                    >
                      <option>Ver: Planta Completa</option>
                      {machinesData.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
                  </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-3xl p-4 sm:p-6 lg:p-10 h-[360px] sm:h-[450px] shadow-sm relative">
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
                  {trendsData.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center flex-col bg-white/80 p-6 text-center">
                      <AlertTriangle className="text-brand-primary mb-2" size={32} />
                      <p className="font-bold text-brand-dark">{dbError || "No hay datos de tendencias."}</p>
                      <p className="text-xs text-brand-gray mt-1">Inténtelo más tarde o verifique la base de datos.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : activeTab === 'horarios' ? (
            <ShiftManager />
          ) : activeTab === 'personal' ? (
            <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="p-6 sm:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-brand-dark">Gestión de Personal</h2>
                  <p className="text-sm text-brand-gray font-medium">Administración de turnos y operarios en planta</p>
                </div>
                <button 
                  onClick={() => setShowCreateOperator(true)}
                  className="bg-brand-primary/10 text-brand-primary px-6 py-2.5 rounded-xl text-sm font-black hover:bg-brand-primary hover:text-white transition-all"
                >
                  + Registrar Operario
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-gray-50 text-brand-gray uppercase text-[10px] font-black tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-5">Operario</th>
                      <th className="px-8 py-5">Turno Asignado</th>
                      <th className="px-8 py-5">Estado</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {operatorsData.length > 0 && operatorsData.map(op => (
                      <tr key={op.id} className="hover:bg-brand-secondary/5 transition-colors group">
                        <td className="px-8 py-5 font-bold text-brand-dark">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-sm text-brand-primary font-black shadow-inner">
                              {op.name ? op.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col">
                              <span>{op.name}</span>
                              <span className="text-[10px] text-brand-gray tracking-widest uppercase">{op.role}</span>
                            </div>
                          </div>
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
                          <div className="flex justify-end gap-3 sm:gap-4">
                            <button 
                              onClick={() => setEditingOperator(op)}
                              className="text-brand-primary hover:text-brand-dark font-black text-[10px] sm:text-xs uppercase tracking-widest transition-colors py-2 px-3 hover:bg-brand-primary/5 rounded-lg"
                            >
                              Modificar
                            </button>
                            <button 
                              onClick={() => handleDeleteOperator(op.id)}
                              className="text-red-500 hover:text-red-700 font-black text-[10px] sm:text-xs uppercase tracking-widest transition-colors py-2 px-3 hover:bg-red-50 rounded-lg"
                            >
                              Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {operatorsData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-10 text-center flex-col items-center">
                          <p className="text-brand-dark font-bold mb-2">
                            {dbError || "No hay operarios registrados."}
                          </p>
                          <p className="text-brand-gray text-xs">
                            Si se trata de un error de conexión, por favor verifica que la URL de base de datos usa IPv4 / Pooler.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-50">
                  <h2 className="text-xl font-black text-brand-dark">Configuración del Panel</h2>
                  <p className="text-sm text-brand-gray font-medium mt-2">Acciones seguras para mantener el panel sincronizado y estable.</p>
                </div>
                <div className="p-6 sm:p-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray mb-3">Usuario autenticado</p>
                    <p className="text-xl font-black text-brand-dark">{currentUser?.name || 'Sin sesión'}</p>
                    <p className="text-sm font-medium text-brand-gray mt-1">Rol actual: {currentUser?.role || 'N/A'}</p>
                  </div>
                  <div className="rounded-3xl border border-gray-100 bg-gray-50/70 p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gray mb-3">Reportes reales en DB</p>
                    <p className="text-3xl font-black text-brand-dark">{reportCount}</p>
                    <p className="text-sm font-medium text-brand-gray mt-1">El contador ya no usa valores demo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center justify-center gap-3 rounded-3xl border border-brand-primary/20 bg-brand-primary/10 p-5 text-brand-primary font-black hover:bg-brand-primary hover:text-white transition-all"
                  >
                    <RefreshCw size={18} />
                    Recargar panel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetLocalData}
                    className="rounded-3xl border border-gray-200 bg-white p-5 text-brand-dark font-black hover:bg-gray-50 transition-all"
                  >
                    Reiniciar revisiones locales
                  </button>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm p-6 sm:p-8 flex flex-col gap-4">
                <h3 className="text-lg font-black text-brand-dark">Sesión y acceso</h3>
                <p className="text-sm text-brand-gray font-medium">
                  Usa esta opción para cerrar la sesión del panel administrativo y evitar accesos no autorizados.
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-auto flex items-center justify-center gap-3 rounded-2xl bg-red-500 text-white px-5 py-4 font-black hover:bg-red-600 transition-all"
                >
                  <LogOut size={18} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Machine Detail Modal */}
      {selectedMachine && (
        <div
          className="fixed inset-0 z-50 bg-brand-dark/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={() => setSelectedMachine(null)}
        >
          <div
            className="bg-white border-2 border-brand-primary/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            
            <div className="p-5 sm:p-8 border-b border-gray-50 flex items-center justify-between gap-4 bg-brand-secondary/5">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-brand-dark flex flex-wrap items-center gap-3 sm:gap-4">
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

            <div className="p-5 sm:p-8 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
              
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
                         {selectedMachine.data?.humedadRelativa || selectedMachine.humidity || '--'}%
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
                           {selectedMachine.data?.volteoNumero || '--'}
                         </p>
                       </div>
                     )}
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-brand-gray uppercase tracking-[0.3em] mb-4 opacity-50">Bitácora de Operario</h3>
                   <div className="bg-brand-secondary/5 p-6 rounded-3xl border border-brand-secondary/20 text-sm text-brand-dark font-medium leading-relaxed italic">
                     "{selectedMachine.observaciones || 'Sin observaciones registradas.'}" 
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
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                       <ImageIcon size={42} className="text-gray-300" />
                       <p className="text-sm font-bold text-brand-gray">Sin evidencia visual registrada</p>
                     </div>
                   )}
                   <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent"></div>
                   <div className="absolute bottom-6 left-6 right-6">
                     <p className="text-[10px] text-white font-black uppercase tracking-widest bg-brand-primary/80 py-2 px-3 rounded-lg backdrop-blur-md inline-block">
                       {(selectedMachine.updatedBy || 'Sin responsable registrado') + ' | ' + selectedMachine.lastUpdate}
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
