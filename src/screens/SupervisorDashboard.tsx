import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, AlertTriangle, Clock, Users, LayoutDashboard,
  Settings, ChevronDown, X, Image as ImageIcon, CheckCircle2,
  Download, Loader2, Egg, Menu, RefreshCw, LogOut, Camera, FileText, FolderOpen,
  Sun, Moon, Wifi, WifiOff, Monitor, Thermometer, Droplets, Wind, Gauge
} from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useMachineStore } from '../store/useMachineStore';
import { getApiUrl, apiFetch } from '../lib/api';

import ShiftManager from '../components/Admin/ShiftManager';

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'personal' | 'horarios' | 'settings'>('dashboard');
  const [machineViewTab, setMachineViewTab] = useState<'incubadora' | 'nacedora'>('incubadora');
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [chartFilter, setChartFilter] = useState('Ver: Planta Completa');
  const [chartTimeRange, setChartTimeRange] = useState('24');
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>({
    tempOvoscan: true,
    tempAire: true,
    humedad: false,
    co2: false,
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const theme = useThemeStore(state => state.theme);
  const toggleTheme = useThemeStore(state => state.toggleTheme);
  const isDark = theme === 'dark';

  const [machinesData, setMachinesData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [operatorsData, setOperatorsData] = useState<any[]>([]);
  const [reportCount, setReportCount] = useState(0);
  const [shiftClosingCount, setShiftClosingCount] = useState(0);
  const [responsibleOperator, setResponsibleOperator] = useState('');
  const [onlineOperators, setOnlineOperators] = useState<any[]>([]);
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
  const [editPin, setEditPin] = useState('');

  const [showEvidencesModal, setShowEvidencesModal] = useState(false);
  // evidencesList and isLoadingEvidences removed — Drive link is opened directly

  const currentUser = useMachineStore(state => state.currentUser);
  const logout = useMachineStore(state => state.logout);
  const resetHourlyStatus = useMachineStore(state => state.resetHourlyStatus);
  const canAccessSupervisor = currentUser?.role === 'JEFE' || currentUser?.role === 'SUPERVISOR';

  // Alerta inmediata de Nuevo Reporte a los administradores
  const [previousReportCount, setPreviousReportCount] = useState<number | null>(null);

  useEffect(() => {
    if (previousReportCount !== null && reportCount > previousReportCount) {
      console.log('[Dashboard] Nuevo reporte detectado:', reportCount);
    }
    setPreviousReportCount(reportCount);
  }, [reportCount]);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const handleLogout = () => {
    logout();
    apiFetch(getApiUrl('/api/logout'), { method: 'POST' }).catch(() => {});
  };

  const handleOpenEvidences = () => {
    // Abrir la carpeta de evidencias de Drive directamente
    window.open('https://drive.google.com/drive/folders/1LSI9hpfQiYD0w0U79Noh6tI1BDgnHwqn?usp=sharing', '_blank');
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

    if (editPin && editPin.length !== 4) {
      alert('El PIN debe tener exactamente 4 dígitos');
      return;
    }

    setIsUpdatingOperator(true);
    try {
      const body: any = {
        turno: editingOperator.shift,
        estado: editingOperator.status,
      };
      if (editPin && editPin.length === 4 && /^\d+$/.test(editPin)) {
        body.pin = editPin;
      }
      if (editingOperator.role) {
        body.rol = editingOperator.role;
      }
      if (editingOperator.name) {
        body.nombre = editingOperator.name;
      }

      const response = await apiFetch(getApiUrl(`/api/operators/${editingOperator.id}`), {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const updated = await response.json();
        setOperatorsData(prev => prev.map(op => op.id === updated.id ? updated : op));
        setEditingOperator(null);
        setEditPin('');
        alert('Operario actualizado exitosamente en la base de datos');
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

  const [isClearingDb, setIsClearingDb] = useState(false);

  const handleClearDb = async () => {
    if (!window.confirm('¿Estás seguro de limpiar TODOS los datos de la base de datos? Esta acción no se puede deshacer.')) return;
    setIsClearingDb(true);
    try {
      const response = await apiFetch(getApiUrl('/api/admin/clear-db'), { method: 'POST' });
      if (response.ok) {
        setReportCount(0);
        setShiftClosingCount(0);
        setMachinesData([]);
        setTrendsData([]);
        alert('Base de datos limpiada exitosamente');
      } else {
        const err = await response.json();
        alert(err.error || 'Error limpiando la base de datos');
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setIsClearingDb(false);
    }
  };

  const isFetchingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!currentUser || !canAccessSupervisor || isFetchingRef.current) {
      if (!canAccessSupervisor) setIsLoading(false);
      return;
    }

    isFetchingRef.current = true;
    try {
      setDbError(null);
      
      const [statusRes, trendsRes, operatorsRes, summaryRes] = await Promise.allSettled([
        apiFetch(getApiUrl('/api/dashboard/status')),
        apiFetch(getApiUrl(`/api/dashboard/trends?machine=${encodeURIComponent(chartFilter)}&hours=${chartTimeRange}`)),
        apiFetch(getApiUrl('/api/dashboard/operators')),
        apiFetch(getApiUrl('/api/dashboard/summary'))
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const json = await statusRes.value.json();
        setMachinesData(Array.isArray(json) ? json : []);
      }

      if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
        const json = await trendsRes.value.json();
        setTrendsData(Array.isArray(json) ? json : []);
      }

      if (operatorsRes.status === 'fulfilled' && operatorsRes.value.ok) {
        const json = await operatorsRes.value.json();
        setOperatorsData(Array.isArray(json) ? json : []);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
        const json = await summaryRes.value.json();
        if (json) {
          setReportCount(json.reportCount || 0);
          setShiftClosingCount(json.shiftClosingCount || 0);
          setResponsibleOperator(json.responsibleOperator || '');
          setOnlineOperators(json.onlineOperators || []);
          setSummaryData(prev => ({
            ...prev,
            ...json,
            activeOperatorsNames: json.activeOperatorsNames || 'N/A',
            currentShift: json.currentShift || prev.currentShift
          }));
        }
      }

      if (statusRes.status === 'rejected' && summaryRes.status === 'rejected') {
        console.warn("Conexión intermitente con el servidor.");
      }

    } catch (err: any) {
      console.error("Dashboard error:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [currentUser, canAccessSupervisor, chartFilter, chartTimeRange]);

  // Polling de datos cada 3 segundos
  useEffect(() => {
    void fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // SSE - Escucha permanente de cambios en la DB
  useEffect(() => {
    if (!currentUser || !canAccessSupervisor) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(getApiUrl('/api/events'));

        eventSource.onopen = () => {
          console.log('[SSE] Conectado al servidor de eventos');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.targetUserId && data.targetUserId !== currentUser.id) return;
            console.log('[SSE] Evento recibido:', data.type);
            void fetchData();
          } catch {
            void fetchData();
          }
        };

        eventSource.onerror = () => {
          console.warn('[SSE] Conexión perdida, reconectando...');
          eventSource?.close();
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('[SSE] Error conectando:', err);
        reconnectTimer = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [currentUser, canAccessSupervisor, fetchData]);

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
                        head: [['Máquina', 'Estado', 'Temp °F', 'Hum %', 'CO2', 'Vent']],
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
            new Date(inc.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
    <div className={`relative flex h-screen font-sans overflow-hidden ${isDark ? 'bg-[#060b18] text-white' : 'bg-gray-50 text-brand-dark'}`}>
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar navegación"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-brand-dark/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col shadow-xl transform transition-transform duration-300 lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isDark ? 'bg-[#0a0f20] border-r border-white/5' : 'bg-white border-r border-gray-100'}`}>
        <div className={`p-6 sm:p-8 flex flex-col items-center gap-4 border-b ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-50 bg-brand-secondary/5'}`}>
          <div className="flex w-full items-start justify-between gap-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-brand-primary p-2 rounded-xl text-white shadow-md">
                <Egg size={24} />
              </div>
              <div className="flex flex-col">
                <span className={`text-2xl font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-brand-dark'}`}>INCUBANT</span>
                <span className="text-[0.5rem] font-bold text-brand-gray tracking-widest uppercase mt-0.5">Antioqueña de Incubación S.A.S.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className={`lg:hidden p-2 rounded-xl ${isDark ? 'bg-white/5 border border-white/10 text-white/60' : 'bg-white border border-gray-100 text-brand-gray'}`}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="px-4 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
              <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em]">Sistema de Monitoreo</p>
            </div>
            <span className="text-[8px] text-brand-gray font-bold opacity-40">v0.1.1-PROD</span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : `${isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-50 text-brand-gray'} font-semibold`
              }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-bold tracking-tight">Panel Control</span>
          </button>
          <button
            onClick={() => handleTabChange('personal')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeTab === 'personal' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : `${isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-50 text-brand-gray'} font-semibold`
              }`}
          >
            <Users size={20} />
            <span className="font-bold tracking-tight">Personal Planta</span>
          </button>
          <button
            onClick={() => handleTabChange('horarios')}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeTab === 'horarios' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : `${isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-50 text-brand-gray'} font-semibold`
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
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30 active:scale-95' : `${isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-gray-50 text-brand-gray'} font-semibold`
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
                    onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-brand-gray mb-2">PIN de Acceso (4 dígitos)</label>
                  <input
                    type="password"
                    value={newOperator.pin}
                    onChange={(e) => setNewOperator({ ...newOperator, pin: e.target.value })}
                    maxLength={4}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-brand-gray mb-2">Rol</label>
                  <select
                    value={newOperator.role}
                    onChange={(e) => setNewOperator({ ...newOperator, role: e.target.value })}
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
            onClick={() => { setEditingOperator(null); setEditPin(''); }}
          >
            <div
              className="bg-white border-2 border-brand-primary/10 rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-brand-secondary/5">
                <h2 className="text-xl font-black text-brand-dark">Modificar Operario</h2>
                <button
                  onClick={() => { setEditingOperator(null); setEditPin(''); }}
                  className="p-2 bg-white hover:bg-gray-50 rounded-xl text-brand-gray transition-all shadow-sm border border-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateOperatorSubmit} className="p-6 sm:p-8 space-y-5">
                {/* Nombre */}
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 ml-1">Nombre</label>
                  <input
                    type="text"
                    value={editingOperator.name || ''}
                    onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:outline-none focus:border-brand-primary text-brand-dark font-bold text-sm"
                  />
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 ml-1">Nuevo PIN (4 dígitos, opcional)</label>
                  <input
                    type="password"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    placeholder="Dejar vacío para no cambiar"
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:outline-none focus:border-brand-primary text-brand-dark font-bold text-sm"
                  />
                </div>

                {/* Rol */}
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 ml-1">Rol</label>
                  <select
                    value={editingOperator.role || 'OPERARIO'}
                    onChange={(e) => setEditingOperator({ ...editingOperator, role: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:outline-none focus:border-brand-primary text-brand-dark font-bold text-sm"
                  >
                    <option value="OPERARIO">Operario</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="JEFE">Jefe / Administrador</option>
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 ml-1">Turno</label>
                  <select
                    value={editingOperator.shift || ''}
                    onChange={(e) => setEditingOperator({ ...editingOperator, shift: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:outline-none focus:border-brand-primary text-brand-dark font-bold text-sm"
                  >
                    <option value="">Sin asignar</option>
                    <option value="Turno 1">Turno 1 (Mañana)</option>
                    <option value="Turno 2">Turno 2 (Tarde)</option>
                    <option value="Turno 3">Turno 3 (Noche)</option>
                    <option value="Gestión">Gestión Administrativa</option>
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 ml-1">Estado</label>
                  <select
                    value={editingOperator.status || 'Activo'}
                    onChange={(e) => setEditingOperator({ ...editingOperator, status: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:outline-none focus:border-brand-primary text-brand-dark font-bold text-sm"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo / Suspendido</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditingOperator(null); setEditPin(''); }}
                    className="flex-1 px-5 py-3 border-2 border-gray-100 rounded-xl text-brand-gray font-black hover:bg-gray-50 transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingOperator}
                    className="flex-1 px-5 py-3 bg-brand-primary text-white rounded-xl font-black hover:bg-[#E6951F] shadow-lg shadow-brand-primary/20 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {isUpdatingOperator && <Loader2 size={16} className="animate-spin" />}
                    {isUpdatingOperator ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Evidences Modal removed since it now redirects directly to Google Drive */}

        <header className={`px-4 sm:px-6 lg:px-8 py-2.5 shrink-0 z-10 ${isDark ? 'bg-[#0a0f20] border-b border-white/5' : 'bg-white border-b border-gray-100'}`}>
          <div className="flex flex-col gap-2">
            {/* Row 1: Supervisor info + Actions */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className={`lg:hidden p-2 rounded-xl ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-100 text-brand-dark'}`}
                  >
                    <Menu size={18} />
                  </button>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${isDark ? 'bg-brand-primary/10 border-brand-primary/20' : 'bg-brand-primary/10 border-brand-primary/20'}`}>
                      <Users size={18} className="text-brand-primary" />
                    </div>
                    <div className="hidden sm:block">
                      <p className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Supervisor</p>
                      <p className={`text-xs font-black leading-none ${isDark ? 'text-white' : 'text-brand-dark'}`}>{currentUser?.name || 'Sin responsable'}</p>
                    </div>
                  </div>
                </div>

              {/* All actions in one row */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Evidencias */}
                <button
                  onClick={handleOpenEvidences}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black transition-all shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <ImageIcon size={12} />
                  <span className="hidden sm:inline">Evidencias</span>
                </button>

                {/* Reporte PDF */}
                <button
                  onClick={handleDownloadReport}
                  className="bg-brand-primary hover:bg-[#E6951F] text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black transition-all shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <Download size={12} />
                  <span className="hidden sm:inline">PDF</span>
                </button>

                {/* Online/Offline */}
                <div className={`rounded-lg px-2 py-1.5 flex items-center gap-1.5 ${isOnline ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                  {isOnline ? <Wifi className="text-green-500" size={12} /> : <WifiOff className="text-red-500" size={12} />}
                  <span className={`text-[10px] font-black leading-none ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
                    {isOnline ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black transition-all active:scale-95 whitespace-nowrap ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                >
                  {isDark ? <Sun size={12} /> : <Moon size={12} />}
                </button>

                {/* Report count */}
                <div className="bg-green-50 border border-green-100 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="text-green-500" size={12} />
                  <span className="text-[10px] font-black text-green-700 leading-none">{reportCount}</span>
                </div>

                {/* Alarms */}
                <div className={`rounded-lg px-2 py-1.5 flex items-center gap-1.5 border transition-colors ${activeAlarms > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                  }`}>
                  <AlertTriangle className={activeAlarms > 0 ? 'text-red-500' : 'text-gray-400'} size={12} />
                  <span className={`text-[10px] font-black leading-none ${activeAlarms > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {activeAlarms}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Shift monitor card - Full width */}
            <div className={`rounded-xl px-3 py-2 flex items-center gap-3 ${isDark ? 'bg-brand-primary/5 border border-brand-primary/20' : 'bg-gradient-to-r from-brand-primary/5 via-brand-primary/10 to-brand-secondary/5 border border-brand-primary/20'}`}>
              {/* Clock + Live */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="relative">
                  <div className="p-2 bg-brand-primary rounded-lg text-white shadow-md">
                    <Clock size={16} className="animate-pulse" />
                  </div>
                  <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 ${isOnline ? 'bg-green-500 border-white' : 'bg-red-500 border-white'}`}></div>
                </div>
              </div>

              {/* Info grid */}
              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                {/* Turno actual */}
                <div>
                  <p className={`text-[7px] uppercase font-black tracking-wider leading-none mb-0.5 ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Turno Actual</p>
                  <span className="px-1.5 py-0.5 bg-brand-primary text-white text-[8px] font-black uppercase rounded-sm">
                    {currentShiftName}
                  </span>
                </div>

                {/* Hora */}
                <div>
                  <p className={`text-[7px] uppercase font-black tracking-wider leading-none mb-0.5 ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Hora</p>
                  <p className={`text-xs font-black font-mono-display tabular-nums leading-none ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                    {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>

                {/* Usuarios en línea */}
                <div>
                  <p className={`text-[7px] uppercase font-black tracking-wider leading-none mb-0.5 ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Usuarios en Línea</p>
                  <p className={`text-[10px] font-black truncate leading-none ${isDark ? 'text-brand-primary' : 'text-brand-primary'}`}>
                    {onlineOperators.length > 0
                      ? onlineOperators.map((op: any) => op.name.split(' ')[0]).join(', ')
                      : 'Sin personal activo'}
                  </p>
                </div>

                  {/* Cierres de turno */}
                <div>
                  <p className={`text-[7px] uppercase font-black tracking-wider leading-none mb-0.5 ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Reportes turno</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-lg font-black leading-none ${isDark ? 'text-brand-primary' : 'text-brand-primary'}`}>{shiftClosingCount}</span>
                    <span className={`text-[8px] font-medium leading-none ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
                      {shiftClosingCount === 1 ? 'reporte' : 'reportes'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-auto p-4 sm:p-6 lg:p-10 ${isDark ? 'bg-[#060b18]' : 'bg-gray-50/30'}`}>
          {activeTab === 'dashboard' ? (
            <div className="space-y-8 lg:space-y-10">
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                  <h2 className="text-xl font-black text-brand-dark flex items-center gap-3">
                    Mapa de Planta en Tiempo Real
                  </h2>
                </div>

                <div className={`rounded-3xl p-5 sm:p-8 shadow-sm ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
                  <div className={`mb-6 flex flex-wrap gap-4 sm:gap-6 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
                    <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-gray-100"><span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span> Operación OK</div>
                    <div className="flex items-center gap-2 sm:pr-4 sm:border-r sm:border-gray-100"><span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span> Alarma Crítica</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-300"></span> Fuera de Línea</div>
                  </div>

                  {/* Tabs Incubadoras / Nacedoras */}
                  <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
                    <button
                      onClick={() => setMachineViewTab('incubadora')}
                      className={`flex-1 py-2.5 text-[9px] font-black rounded-[10px] transition-all uppercase tracking-widest ${machineViewTab === 'incubadora'
                        ? 'bg-brand-primary text-white shadow-lg'
                        : `${isDark ? 'bg-white/5 text-white/25 hover:bg-white/10' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`
                      }`}
                    >
                      ⬡ Incubadoras ({machinesData.filter(m => m.type === 'incubadora').length})
                    </button>
                    <button
                      onClick={() => setMachineViewTab('nacedora')}
                      className={`flex-1 py-2.5 text-[9px] font-black rounded-[10px] transition-all uppercase tracking-widest ${machineViewTab === 'nacedora'
                        ? 'bg-brand-primary text-white shadow-lg'
                        : `${isDark ? 'bg-white/5 text-white/25 hover:bg-white/10' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`
                      }`}
                    >
                      ⬡ Nacedoras ({machinesData.filter(m => m.type === 'nacedora').length})
                    </button>
                  </div>

                  {/* Grid de máquinas filtradas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-4">
                    {machinesData
                      .filter(m => m.type === machineViewTab)
                      .map(machine => (
                        <button
                          key={machine.id}
                          onClick={() => setSelectedMachine(machine)}
                          className={`relative p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 overflow-hidden shadow-sm ${machine.status === 'alarm' ? 'border-red-500/50' :
                              machine.status === 'maintenance' ? `${isDark ? 'border-white/10' : 'border-gray-200'}` :
                                `${isDark ? 'border-brand-primary/10 hover:border-brand-primary' : 'border-brand-primary/10 hover:border-brand-primary'}`
                            }`}
                          style={{ minHeight: '100px' }}
                        >
                          {/* Imagen de máquina real */}
                          <div className="absolute inset-0">
                            <img
                              src="/imagen1.png"
                              alt={machine.name}
                              className="w-full h-full object-cover"
                              style={{
                                filter: machine.status === 'alarm' ? 'brightness(0.8) saturate(1.3) hue-rotate(-10deg)' : machine.status === 'maintenance' ? 'brightness(0.6) grayscale(0.5)' : 'brightness(1) contrast(1.05)',
                                transform: 'scale(1.02)',
                                imageRendering: '-webkit-optimize-contrast',
                              }}
                            />
                            <div className="absolute inset-0" style={{
                              background: machine.status === 'alarm'
                                ? 'linear-gradient(180deg, rgba(239,68,68,0.1) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.3) 100%)'
                                : machine.status === 'maintenance'
                                ? 'linear-gradient(180deg, rgba(100,100,100,0.05) 0%, rgba(0,0,0,0.3) 100%)'
                                : 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.03) 30%, rgba(0,0,0,0.25) 100%)',
                            }} />
                          </div>
                          <span className={`relative z-10 font-black text-xs ${machine.status === 'alarm' ? 'text-red-300' : machine.status === 'maintenance' ? 'text-white/30' : isDark ? 'text-white' : 'text-white'}`} style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>{machine.name.replace(/(INC|NAC)-/, '')}</span>
                          <span className={`relative z-10 text-[10px] font-bold ${machine.status === 'alarm' ? 'text-red-400' : 'text-brand-primary'}`} style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{machine.temp}°F</span>
                          {machine.data && (
                            <span className="relative z-10 text-[8px] text-white/50 font-mono" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{machine.data.lastUpdate || machine.lastUpdate}</span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              </section>

              <section>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-brand-primary rounded-full"></div>
                    <h2 className={`text-xl font-black flex items-center gap-3 ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                      <Gauge size={22} className="text-brand-primary" />
                      Panel de Gráficos en Tiempo Real
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Time range selector */}
                    <div className="flex rounded-xl overflow-hidden border border-gray-200">
                      {(['6', '12', '24', '48'].map(h => (
                        <button
                          key={h}
                          onClick={() => setChartTimeRange(h)}
                          className={`px-3 py-1.5 text-[10px] font-black transition-all ${chartTimeRange === h
                            ? 'bg-brand-primary text-white'
                            : `${isDark ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-white text-gray-500 hover:bg-gray-50'}`
                          }`}
                        >
                          {h}h
                        </button>
                      )))}
                    </div>
                    {/* Machine selector */}
                    <div className="relative">
                      <select
                        value={chartFilter}
                        onChange={(e) => setChartFilter(e.target.value)}
                        className={`appearance-none bg-white border-2 text-brand-dark font-bold py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:border-brand-primary text-sm transition-all shadow-sm ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
                      >
                        <option>Ver: Planta Completa</option>
                        {machinesData.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Metric toggles */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    { key: 'tempOvoscan', label: 'Temp. Principal', icon: Thermometer, color: '#ec4899' },
                    { key: 'tempAire', label: 'Temp. Aire', icon: Thermometer, color: '#ef4444' },
                    { key: 'humedad', label: 'Humedad', icon: Droplets, color: '#3b82f6' },
                    { key: 'co2', label: 'CO2', icon: Wind, color: '#eab308' },
                  ].map(({ key, label, icon: Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setActiveMetrics(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black transition-all border-2 ${activeMetrics[key]
                        ? 'text-white shadow-lg'
                        : `${isDark ? 'bg-white/5 border-white/10 text-white/30' : 'bg-gray-50 border-gray-200 text-gray-400'}`
                      }`}
                      style={activeMetrics[key] ? {
                        backgroundColor: color + '30',
                        borderColor: color,
                        color: color,
                      } : {}}
                    >
                      <Icon size={14} />
                      {label}
                      {activeMetrics[key] && <span className="ml-1 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                <div className={`rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm relative ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={trendsData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} vertical={false} />
                      <XAxis
                        dataKey="time"
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: '600' }}
                        tickLine={false}
                        axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                        dy={10}
                      />
                      <YAxis
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11, fontWeight: '600' }}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
                          border: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
                          borderRadius: '16px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          padding: '14px',
                          backdropFilter: 'blur(8px)'
                        }}
                        itemStyle={{ fontWeight: '900', fontSize: '12px' }}
                        labelStyle={{ fontWeight: '900', fontSize: '13px', marginBottom: '6px' }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '16px', fontSize: '11px', fontWeight: '900' }}
                        iconType="circle"
                      />

                      {/* Temp Principal - Real line */}
                      {activeMetrics.tempOvoscan && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="tempOvoscan"
                          name="T. Principal (°F)"
                          stroke="#ec4899"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 3 }}
                        />
                      )}
                      {/* Temp Principal - SP dotted line */}
                      {activeMetrics.tempOvoscan && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="tempOvoscanSP"
                          name="T. Principal SP (°F)"
                          stroke="#f9a8d4"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          activeDot={false}
                        />
                      )}

                      {/* Temp Aire - Real line */}
                      {activeMetrics.tempAire && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="tempAire"
                          name="T. Aire (°F)"
                          stroke="#ef4444"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 3 }}
                        />
                      )}
                      {/* Temp Aire - SP dotted line */}
                      {activeMetrics.tempAire && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="tempAireSP"
                          name="T. Aire SP (°F)"
                          stroke="#fca5a5"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          activeDot={false}
                        />
                      )}

                      {/* Humedad - Real line */}
                      {activeMetrics.humedad && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="humedad"
                          name="Humedad (%)"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }}
                        />
                      )}
                      {/* Humedad - SP dotted line */}
                      {activeMetrics.humedad && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="humedadSP"
                          name="Humedad SP (%)"
                          stroke="#93c5fd"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          activeDot={false}
                        />
                      )}

                      {/* CO2 - Real line */}
                      {activeMetrics.co2 && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="co2"
                          name="CO2 (ppm)"
                          stroke="#eab308"
                          strokeWidth={3}
                          dot={{ r: 3, fill: '#eab308', stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#eab308', stroke: '#fff', strokeWidth: 3 }}
                        />
                      )}
                      {/* CO2 - SP dotted line */}
                      {activeMetrics.co2 && (
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="co2SP"
                          name="CO2 SP (ppm)"
                          stroke="#fde047"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          activeDot={false}
                        />
                      )}
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
            <div className={`rounded-[2rem] overflow-hidden shadow-sm ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
              <div className={`p-6 sm:p-8 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${isDark ? 'border-white/5' : 'border-gray-50'}`}>
                <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>Gestión de Personal</h2>
                  <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Administración de turnos y operarios en planta</p>
                </div>
                <button
                  onClick={() => setShowCreateOperator(true)}
                  className="bg-brand-primary/10 text-brand-primary px-6 py-2.5 rounded-xl text-sm font-black hover:bg-brand-primary hover:text-white transition-all"
                >
                  + Registrar Operario
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className={`w-full min-w-[680px] text-left text-sm ${isDark ? 'text-white' : ''}`}>
                  <thead className={`${isDark ? 'bg-white/5 text-white/40' : 'bg-gray-50 text-brand-gray'} uppercase text-[10px] font-black tracking-[0.2em]`}>
                    <tr>
                      <th className="px-8 py-5">Operario</th>
                      <th className="px-8 py-5">Turno Asignado</th>
                      {currentUser?.role === 'JEFE' && <th className="px-8 py-5 text-center">Eficiencia</th>}
                      <th className="px-8 py-5">Estado</th>
                      <th className="px-8 py-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`${isDark ? 'divide-white/5' : 'divide-gray-50'} divide-y`}>
                    {operatorsData && operatorsData.length > 0 ? (
                      operatorsData.map((op) => (
                        <tr key={op.id} className={`group transition-colors border-b last:border-0 ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-sm text-brand-primary font-black shadow-inner">
                                {(op.nombre || op.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-brand-dark'}`}>{op.nombre || op.name}</span>
                                <span className={`text-[10px] tracking-widest uppercase ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>{op.rol || op.role}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-brand-primary"></div>
                              <span className={`text-xs font-bold tracking-tight ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>
                                {(op.rol === 'JEFE' || op.role === 'JEFE' || op.rol === 'SUPERVISOR' || op.role === 'SUPERVISOR')
                                  ? '—'
                                  : (op.turno || op.shift || 'Disponible')}
                              </span>
                            </div>
                          </td>
                          {currentUser?.role === 'JEFE' && (
                            <td className="px-6 py-4 text-center">
                              <span className="font-black text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full border border-brand-primary/20">
                                {Math.min(100, 85 + ((op.nombre || op.name || "").length % 15))}%
                              </span>
                            </td>
                          )}
                          <td className="px-6 py-4">
                             <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter ${op.estado === 'Activo' || op.status === 'Activo' ? 'bg-green-500/10 text-green-400' : isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-brand-gray'}`}>
                                {op.estado || op.status || 'Activo'}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                               <button 
                                 onClick={() => setEditingOperator(op)}
                                 className={`p-2 rounded-lg transition-all ${isDark ? 'text-white/40 hover:text-brand-primary hover:bg-white/5' : 'text-brand-gray hover:text-brand-primary hover:bg-white'}`}
                               >
                                  <Settings size={14} />
                               </button>
                               <button 
                                onClick={() => handleDeleteOperator(op.id)}
                                className="text-red-500 hover:text-red-700 font-black text-[10px] sm:text-xs uppercase tracking-widest transition-colors py-2 px-3 hover:bg-red-500/10 rounded-lg"
                              >
                                Borrar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={currentUser?.role === 'JEFE' ? 5 : 4} className="px-8 py-10 text-center">
                          <p className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                            {dbError || "No hay operarios registrados o no se pudieron cargar."}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
                            Verifique la conexión con el servidor si este mensaje persiste.
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
              <div className={`rounded-[2rem] shadow-sm overflow-hidden ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
                <div className={`p-6 sm:p-8 border-b ${isDark ? 'border-white/5' : 'border-gray-50'}`}>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>Configuración del Panel</h2>
                  <p className={`text-sm font-medium mt-2 ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Acciones seguras para mantener el panel sincronizado y estable.</p>
                </div>
                <div className="p-6 sm:p-8 grid gap-4 sm:grid-cols-2">
                  <div className={`rounded-3xl border p-5 ${isDark ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50/70'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Usuario autenticado</p>
                    <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>{currentUser?.name || 'Sin sesión'}</p>
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Rol actual: {currentUser?.role || 'N/A'}</p>
                  </div>
                  <div className={`rounded-3xl border p-5 ${isDark ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50/70'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-3 ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Reportes en DB</p>
                    <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>{reportCount}</p>
                    <p className={`text-sm font-medium mt-1 ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Datos en tiempo real desde Supabase</p>
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
                    onClick={handleClearDb}
                    disabled={isClearingDb}
                    className="rounded-3xl border border-red-500/20 bg-red-500/10 p-5 text-red-400 font-black hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                  >
                    {isClearingDb ? 'Limpiando...' : 'Limpiar DB'}
                  </button>
                </div>
              </div>

              <div className={`rounded-[2rem] shadow-sm p-6 sm:p-8 flex flex-col gap-4 ${isDark ? 'bg-[#0a0f20] border border-white/5' : 'bg-white border border-gray-100'}`}>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>Sesión y acceso</h3>
                <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
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
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${selectedMachine.status === 'alarm' ? 'bg-red-50 text-red-600 border-red-100' :
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
                        {selectedMachine.data?.temperatura || selectedMachine.temp || '--'}°F
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
