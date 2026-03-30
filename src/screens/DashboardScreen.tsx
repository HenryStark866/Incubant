import React, { useState, useEffect } from 'react';
import { useMachineStore, MachineType, Machine } from '../store/useMachineStore';
import { CheckCircle2, Clock, UploadCloud, Loader2, LogOut, ChevronRight, Egg, AlertTriangle, X, Download, FileText, Camera } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getApiUrl, apiFetch } from '../lib/api';
import ReportUploader from '../components/ReportUploader';

// Specialized Confirmation Modal
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  pendingCount,
  pendingMachines = [] 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void,
  pendingCount: number,
  pendingMachines?: Machine[]
}) => {
  if (!isOpen) return null;
  const safeMachines = pendingMachines || [];

  return (
    <div className="fixed inset-0 z-[100] bg-brand-dark/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 border border-orange-100 mx-auto">
            <AlertTriangle size={32} className="text-[#F5A623]" />
          </div>
          
          <h2 className="text-2xl font-black text-brand-dark text-center mb-4 leading-tight">
            ¿Enviar reporte incompleto?
          </h2>
          
          <p className="text-gray-500 text-center font-medium mb-6 leading-relaxed">
            Faltan <span className="text-brand-dark font-black underline">{pendingCount} máquinas</span> por registrar. <br/>
            Las máquinas sin datos se marcarán automáticamente como <span className="text-orange-600 font-bold">"APAGADA"</span>.
          </p>

          <div className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Máquinas Pendientes:</p>
            <div className="flex flex-wrap gap-2">
              {pendingMachines.map(m => (
                <span key={m.id} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-black text-brand-dark">
                  #{m.number}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onConfirm}
              className="w-full py-5 bg-[#F5A623] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
            >
              Sí, Enviar Reporte
            </button>
            <button
              onClick={onClose}
              className="w-full py-5 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
            >
              Volver a Revisar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<MachineType>('incubadora');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'uploading' | 'database' | 'pdf'>('uploading');
  const [reportUploaderMachine, setReportUploaderMachine] = useState<Machine | null>(null);
  
  const machines = useMachineStore(state => state.machines);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const resetHourlyStatus = useMachineStore(state => state.resetHourlyStatus);
  const currentUser = useMachineStore(state => state.currentUser);
  const login = useMachineStore(state => state.login);
  const logout = useMachineStore(state => state.logout);

  // Poll de estado en tiempo real para ser alertado si el Jefe cambia el turno
  useEffect(() => {
    if (!currentUser) return;
    
    // Lazy import the notification utility
    const notifyChange = async (user: any) => {
      const { showAppNotification } = await import('../utils/notifications');
      await showAppNotification('¡Atención: Cambio de Turno!', {
        body: `Un Administrador te ha reasignado al ${user.shift}. Se actualizará tu panel automáticamente.`,
        icon: '/pwa-192x192.png'
      });
    };

    const checkRealtimeStatus = async () => {
      try {
        const res = await apiFetch(getApiUrl('/api/session'));
        if (res.ok) {
          const { user } = await res.json();
          if (user && user.shift !== currentUser.shift) {
            // El Jefe acaba de actualizar el turno de este operario en la DB!
            void notifyChange(user);
            login(user); // Refrescamos DB -> App state
          }
        }
      } catch (e) {
        // Silencioso, puede fallar por problemas de red esporádicos
      }
    };

    const interval = setInterval(checkRealtimeStatus, 15000); // Check cada 15 segundos
    return () => clearInterval(interval);
  }, [currentUser, login]);

  const filteredMachines = machines.filter(m => m.type === activeTab);

  const pendingMachines = machines.filter(m => m.status === 'pending');
  const pendingCount = pendingMachines.length;
  const completedCount = machines.filter(m => m.status === 'completed').length;
  const allCompleted = pendingCount === 0;

  const handleLogout = async () => {
    if (!window.confirm('¿Estás seguro de que deseas cerrar turno? Se generará y guardará tu Reporte de Cierre de Turno en la Bóveda.')) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncPhase('pdf');

      // Generar Reporte de Fin de Turno
      const res = await apiFetch(getApiUrl('/api/my-shift-report'));
      if (res.ok) {
        const logs = await res.json();
        
        if (logs.length > 0) {
          const doc = new jsPDF('landscape');
          doc.setFontSize(16);
          doc.setTextColor(245, 166, 35);
          doc.text(`INCUBANT - REPORTE CIERRE DE TURNO`, 14, 15);
          
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 40);
          doc.text(`Operario: ${currentUser?.name} | Turno: ${currentUser?.shift || 'Turno 1'}`, 14, 22);
          doc.text(`Fecha de Cierre: ${new Date().toLocaleString()}`, 14, 27);
          doc.text(`Total de registros: ${logs.length}`, 14, 32);

          const tableData = logs.map((log: any) => [
            new Date(log.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            `${log.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${log.machine.numero_maquina.toString().padStart(2, '0')}`,
            log.temp_principal_actual.toFixed(1),
            log.temp_secundaria_actual.toFixed(1),
            log.co2_actual.toFixed(1),
            log.observaciones || 'OK - Sin Novedad'
          ]);

          autoTable(doc, {
            startY: 38,
            head: [['Hora', 'Máquina', 'T. Ovoscan (F)', 'T. Aire (F)', 'Humedad / CO2', 'Observaciones']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [245, 166, 35], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
          });

          // Guardar PDF localmente y en Supabase (Nube)
          const pdfBlob = doc.output('blob');
          doc.save(`Cierre_Turno_${currentUser?.name?.replace(/\s+/g,'_')}.pdf`);
          
          const { uploadEvidencePDF } = await import('../lib/supabase');
          await uploadEvidencePDF(pdfBlob, `${currentUser?.name}_CIERRE_TURNO_${new Date().getTime()}`);
        } else {
          alert('Tu turno no tiene ningún registro de temperatura. Se cerrará la sesión directamente.');
        }
      }

      await apiFetch(getApiUrl('/api/logout'), { method: 'POST' });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    } finally {
      setIsSyncing(false);
      logout();
    }
  };

  const handleMachineClick = (machine: Machine) => {
    if (machine.status === 'pending') {
      // Primero abrir el ReportUploader de foto rápida con IA
      // Si el usuario lo cierra sin subir, puede continuar con el formulario manual
      setActiveMachine(machine.id);
    }
  };

  const handleOpenReportUploader = (e: React.MouseEvent, machine: Machine) => {
    e.stopPropagation();
    setReportUploaderMachine(machine);
  };

  const generatePDF = async (syncedMachines: Machine[]) => {
    try {
      const doc = new jsPDF();
      
      // Estilos Base
      const primaryColor: [number, number, number] = [245, 166, 35]; // #F5A623
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text('INCUBANT MONITOR', 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text('REPORTE DIARIO DE OPERACIÓN', 14, 28);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${new Date().toLocaleDateString()} | Hora: ${new Date().toLocaleTimeString()}`, 14, 35);
      doc.text(`Operario: ${currentUser?.name || 'Sistema'}`, 14, 40);

      // Tabla de Incubadoras
      const incs = syncedMachines.filter(m => m.type === 'incubadora');
      const incData = incs.map(m => {
        const d = m.data;
        const time = d?.tiempoIncubacion ? `${d.tiempoIncubacion.dias}d ${d.tiempoIncubacion.horas}h ${d.tiempoIncubacion.minutos}m` : '--';
        return [
          m.number,
          m.status === 'completed' ? 'OK' : 'APAGADA',
          time,
          d?.tempOvoscanReal || '--',
          d?.tempOvoscanSP || '--',
          d?.tempAireReal || '--',
          d?.tempAireSP || '--',
          d?.humedadReal || '--',
          d?.co2Real || '--',
          d?.volteoNumero || '--',
          d?.volteoPosicion || '--',
          d?.alarma || 'No',
          d?.ventiladorPrincipal || '--',
          m.photoUrl ? 'VER FOTO' : '--',
          d?.observaciones || ''
        ];
      });

      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text('CONTROL INCUBADORAS', 14, 55);

      autoTable(doc, {
        startY: 60,
        head: [['N°', 'Est.', 'Tiempo', 'Real', 'SP', 'Aire', 'ASP', 'Hum%', 'CO2', 'V/N', 'V/P', 'Alm', 'Vent', 'Evid.', 'Obs']],
        body: incData,
        theme: 'grid',
        headStyles: { fillColor: [245, 166, 35] as [number, number, number], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7 },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 11 && data.cell.text[0] === 'VER FOTO') {
            const machine = incs[data.row.index];
            if (machine.photoUrl) {
              doc.link(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, { url: machine.photoUrl });
            }
          }
        },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 11 && data.cell.text[0] === 'VER FOTO') {
            doc.setTextColor(0, 0, 255);
          }
        }
      });

      // Tabla de Nacedoras
      const nacs = syncedMachines.filter(m => m.type === 'nacedora');
      const nacData = nacs.map(m => {
        const d = m.data;
        const time = d?.tiempoIncubacion ? `${d.tiempoIncubacion.dias}d ${d.tiempoIncubacion.horas}h ${d.tiempoIncubacion.minutos}m` : '--';
        return [
          m.number,
          m.status === 'completed' ? 'OK' : 'APAGADA',
          time,
          d?.tempSynchroReal || '--',
          d?.tempSynchroSP || '--',
          d?.humedadReal || '--',
          d?.co2Real || '--',
          d?.ventiladorPrincipal || '--',
          m.photoUrl ? 'VER FOTO' : '--',
          d?.observaciones || ''
        ];
      });

      const currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.text('CONTROL NACEDORAS', 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['N°', 'Est.', 'Tiempo', 'Temp', 'Hum%', 'CO2', 'Vent', 'Evid.', 'Obs']],
        body: nacData,
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8 },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 7 && data.cell.text[0] === 'VER FOTO') {
            const machine = nacs[data.row.index];
            if (machine.photoUrl) {
              doc.link(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, { url: machine.photoUrl });
            }
          }
        },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 7 && data.cell.text[0] === 'VER FOTO') {
            doc.setTextColor(0, 0, 255);
          }
        }
      });

      const pdfBlob = doc.output('blob');
      doc.save(`Reporte_Incubant_${new Date().toISOString().split('T')[0]}.pdf`);
      
      const { uploadEvidencePDF } = await import('../lib/supabase');
      await uploadEvidencePDF(pdfBlob, currentUser?.name || 'Sistema');
    } catch (err) {
      console.error('PDF Error:', err);
    }
  };

  const handleSyncAttempt = () => {
    if (allCompleted) {
      executeSync();
    } else {
      setShowConfirm(true);
    }
  };

  const executeSync = async () => {
    setShowConfirm(false);
    setIsSyncing(true);
    setSyncPhase('uploading');
    
    try {
      // 0. Preparar máquinas (marcar faltantes como apagadas)
      const preparedMachines = machines.map(m => {
        if (m.status === 'pending') {
          return {
            ...m,
            status: 'completed' as const, // Marcar como revisada pero 'apagada'
            data: {
              tiempoIncubacion: { dias: '0', horas: '0', minutos: '0' },
              tempOvoscanReal: '0',
              tempOvoscanSP: '0',
              tempAireReal: '0',
              tempAireSP: '0',
              tempSynchroReal: '0',
              tempSynchroSP: '0',
              temperaturaReal: '0',
              temperaturaSP: '0',
              humedadReal: '0',
              humedadSP: '0',
              co2Real: '0',
              co2SP: '0',
              observaciones: 'MÁQUINA APAGADA (Sin registro operario)',
              alarma: 'No' as const,
              volteoPosicion: '' as const,
              volteoNumero: '0',
              ventiladorPrincipal: 'No' as const
            }
          };
        }
        return m;
      });

      // 1. Upload images to Supabase
      const { uploadEvidenceImage } = await import('../lib/supabase');
      
      const machinesWithUploadedPhotos = await Promise.all(
        preparedMachines.map(async (machine) => {
          if (machine.photoUrl && machine.photoUrl.startsWith('data:image')) {
            try {
              const publicUrl = await uploadEvidenceImage(machine.photoUrl, machine.id);
              return { ...machine, photoUrl: publicUrl };
            } catch (err) {
              console.error(`Failed to upload image for machine ${machine.id}`, err);
              return machine;
            }
          }
          return machine;
        })
      );

      // 2. Send data to backend
      setSyncPhase('database');
      const response = await apiFetch(getApiUrl('/api/sync-hourly'), {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUser?.id,
          machines: machinesWithUploadedPhotos
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar los datos en el servidor');
      }

      // 3. Generar y Descargar PDF
      setSyncPhase('pdf');
      await generatePDF(machinesWithUploadedPhotos);

      setSyncSuccess(true);
      setTimeout(() => {
        setSyncSuccess(false);
        resetHourlyStatus();
      }, 2000);

    } catch (error) {
      console.error("Error de sincronización:", error);
      alert('Hubo un error al sincronizar. Por favor verifica tu conexión.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F5F7] relative font-sans">
      {/* Overlay de Sincronización */}
      {(isSyncing || syncSuccess) && (
        <div className="absolute inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center text-center w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            {isSyncing ? (
              <>
                <div className="relative mb-8">
                  <Loader2 className="w-20 h-20 text-[#F5A623] animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {syncPhase === 'uploading' && <UploadCloud size={24} className="text-[#F5A623]" />}
                    {syncPhase === 'database' && <UploadCloud size={24} className="text-[#F5A623]" />}
                    {syncPhase === 'pdf' && <FileText size={24} className="text-[#F5A623]" />}
                  </div>
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-4 uppercase tracking-tight">
                  {syncPhase === 'uploading' ? 'Subiendo Evidencia...' : 
                   syncPhase === 'database' ? 'Guardando Datos...' : 
                   'Generando Reporte...'}
                </h2>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                   <div className="h-full bg-brand-primary animate-progress-fast"></div>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-2 uppercase tracking-tight">¡Éxito!</h2>
                <p className="text-gray-500 font-medium">Sincronización y Reporte completados.</p>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executeSync}
        pendingCount={pendingCount}
        pendingMachines={pendingMachines}
      />

      {/* Header Corporativo */}
      <div className="bg-white px-6 py-5 border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-brand-primary p-1.5 rounded-lg text-white shadow-sm">
                <Egg size={18} />
              </div>
              <span className="text-lg font-black text-brand-dark tracking-tight leading-none pb-0.5 pointer-events-none">INCUBANT</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Operario Activo</p>
              <p className="text-sm font-black text-brand-primary">
                {currentUser?.name} 
                <span className="text-xs text-gray-400 ml-1 font-bold">({currentUser?.shift || 'Turno 1'})</span>
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-3 bg-[#F5F5F7] text-gray-500 rounded-xl hover:text-red-500 hover:bg-red-50 transition-colors active:scale-95"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Tabs de Navegación */}
        <div className="flex bg-[#F5F5F7] rounded-xl p-1.5 border border-gray-200">
          <button
            onClick={() => setActiveTab('incubadora')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'incubadora' 
                ? 'bg-white text-[#1A1A1A] shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Incubadoras
          </button>
          <button
            onClick={() => setActiveTab('nacedora')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'nacedora' 
                ? 'bg-white text-[#1A1A1A] shadow-sm' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Nacedoras
          </button>
        </div>
      </div>

      {/* Resumen / Stats */}
      <div className="px-6 py-5">
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl">
              <Clock className="text-[#F5A623]" size={22} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pendientes</p>
              <p className="text-2xl font-black text-[#1A1A1A] leading-none mt-1">{pendingCount}</p>
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle2 className="text-green-500" size={22} />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Completadas</p>
              <p className="text-2xl font-black text-[#1A1A1A] leading-none mt-1">{completedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Máquinas */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Listado de {activeTab === 'incubadora' ? 'Incubadoras' : 'Nacedoras'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredMachines.map(machine => {
            const d = machine.data;
            let isAlarm = false;
            let val1Real = '--', val1SP = '--', val2Real = '--', val2SP = '--';
            let label1 = 'Ovo', label2 = 'Aire';

            if (machine.status === 'completed' && d) {
              const calcDiff = (r?: string, s?: string) => Math.abs(parseFloat(r || '0') - parseFloat(s || '0'));
              
              if (machine.type === 'incubadora') {
                val1Real = d.tempOvoscanReal || '--';
                val1SP = d.tempOvoscanSP || '--';
                val2Real = d.tempAireReal || '--';
                val2SP = d.tempAireSP || '--';
                isAlarm = calcDiff(d.tempOvoscanReal, d.tempOvoscanSP) >= 1.5 || calcDiff(d.tempAireReal, d.tempAireSP) >= 1.5;
              } else {
                label1 = 'Syn';
                val1Real = d.tempSynchroReal || '--';
                val1SP = d.tempSynchroSP || '--';
                val2Real = d.temperaturaReal || '--';
                val2SP = d.temperaturaSP || '--';
                isAlarm = calcDiff(d.tempSynchroReal, d.tempSynchroSP) >= 1.5 || calcDiff(d.temperaturaReal, d.temperaturaSP) >= 1.5;
              }
            }

            return (
              <button
                key={machine.id}
                onClick={() => handleMachineClick(machine)}
                disabled={machine.status === 'completed' && !isAlarm}
                className={`relative p-4 rounded-[2rem] border-2 flex flex-col items-stretch justify-between transition-all active:scale-95 overflow-hidden min-h-[140px] ${
                  machine.status === 'completed'
                    ? isAlarm 
                      ? 'bg-red-50 border-red-400 text-red-700 shadow-lg shadow-red-200 ring-4 ring-red-50' 
                      : 'bg-green-50/50 border-green-200 text-green-700'
                    : 'bg-white border-gray-100 text-[#1A1A1A] shadow-sm hover:border-[#F5A623]/50'
                }`}
              >
                {/* Background Image Layer */}
                <div 
                  className="absolute inset-0 z-0 opacity-10 mix-blend-multiply bg-cover bg-center"
                  style={{ backgroundImage: 'url(/imagen1.png)' }}
                />
                
                <div className="flex items-center justify-between w-full mb-2 z-10 relative">
                  <div className="flex flex-col items-start">
                    <span className="text-3xl font-black tracking-tighter leading-none">{machine.number}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      machine.status === 'completed' ? isAlarm ? 'text-red-600' : 'text-green-600' : 'text-gray-400'
                    }`}>
                      {machine.status === 'completed' ? isAlarm ? '⚠️ ALARMA' : 'REVISADA' : 'PENDIENTE'}
                    </span>
                  </div>
                  
                  {machine.status === 'completed' ? (
                    <div className={`rounded-full p-1.5 shadow-sm border ${isAlarm ? 'bg-red-500 text-white border-red-400' : 'bg-green-500 text-white border-green-400'}`}>
                      {isAlarm ? <AlertTriangle size={14} strokeWidth={3} /> : <CheckCircle2 size={14} strokeWidth={3} />}
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <div 
                        onClick={(e) => handleOpenReportUploader(e, machine)}
                        className="bg-brand-primary text-white rounded-xl p-2 shadow-sm hover:bg-[#E6951F] transition-colors"
                      >
                        <Camera size={14} />
                      </div>
                    </div>
                  )}
                </div>

                {machine.status === 'completed' && d && (
                  <div className="mt-auto space-y-1 z-10 relative">
                    <div className="flex justify-between items-end border-t border-black/5 pt-2">
                       <div className="flex flex-col">
                          <span className="text-[7px] font-black text-black/40 uppercase leading-none">{label1}</span>
                          <span className="text-sm font-black tracking-tight">{val1Real}°</span>
                       </div>
                       <div className="flex flex-col items-end opacity-60">
                          <span className="text-[7px] font-black text-black/40 uppercase leading-none">SP</span>
                          <span className="text-[10px] font-bold">{val1SP}°</span>
                       </div>
                    </div>
                    <div className="flex justify-between items-end">
                       <div className="flex flex-col">
                          <span className="text-[7px] font-black text-black/40 uppercase leading-none">{label2}</span>
                          <span className="text-sm font-black tracking-tight">{val2Real}°</span>
                       </div>
                       <div className="flex flex-col items-end opacity-60">
                          <span className="text-[7px] font-black text-black/40 uppercase leading-none">SP</span>
                          <span className="text-[10px] font-bold">{val2SP}°</span>
                       </div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Botón de Sincronización */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#F5F5F7] via-[#F5F5F7] to-transparent z-20">
        <button 
          onClick={handleSyncAttempt}
          disabled={isSyncing}
          className={`w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all uppercase tracking-widest shadow-xl ${
            isSyncing 
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-[#F5A623] text-white active:scale-95 shadow-[#F5A623]/30'
          }`}
        >
          <UploadCloud size={24} />
          Sincronizar Operación
        </button>
      </div>

      {/* Modal de ReportUploader con IA */}
      {reportUploaderMachine && (
        <ReportUploader
          machineId={reportUploaderMachine.id}
          machineName={`${reportUploaderMachine.type === 'incubadora' ? 'Incubadora' : 'Nacedora'} #${reportUploaderMachine.number}`}
          onClose={() => setReportUploaderMachine(null)}
          onSuccess={() => {
            setReportUploaderMachine(null);
          }}
        />
      )}
    </div>
  );
}
