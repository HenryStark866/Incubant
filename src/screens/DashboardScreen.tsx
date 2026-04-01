import React, { useState, useEffect } from 'react';
import { useMachineStore, MachineType, Machine } from '../store/useMachineStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  CheckCircle2, Clock, UploadCloud, Loader2, LogOut, Egg,
  AlertTriangle, FileText, Camera, Zap, Activity, Cpu, Wifi, WifiOff, Sun, Moon, Monitor
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getApiUrl, apiFetch } from '../lib/api';
import ReportUploader from '../components/ReportUploader';

/* ─────────────────────────────────────────────
   Modal de confirmación futurista
───────────────────────────────────────────── */
const ConfirmationModal = ({
  isOpen, onClose, onConfirm, pendingCount, pendingMachines = []
}: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  pendingCount: number; pendingMachines?: Machine[];
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-end justify-center p-4 animate-fade-in">
      <div className="glass-light rounded-3xl w-full max-w-md overflow-hidden border border-brand-primary/20 animate-slide-up">
        {/* Línea superior decorativa */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, transparent, #f7931a, #ffb800, transparent)' }} />
        <div className="p-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto hud-corners"
            style={{ background: 'rgba(247,147,26,0.12)', border: '1px solid rgba(247,147,26,0.3)' }}>
            <AlertTriangle size={28} className="text-brand-primary animate-pulse-glow" />
          </div>
          <h2 className="text-xl font-black text-white text-center mb-2 font-mono-display tracking-wider">
            ¿Enviar Incompleto?
          </h2>
          <p className="text-white/40 text-center text-xs font-medium mb-5 leading-relaxed">
            Faltan <span className="text-brand-primary font-black">{pendingCount} máquinas</span> por registrar.
            Se marcarán como <span className="text-red-400 font-black">APAGADA</span> automáticamente.
          </p>
          {pendingMachines.length > 0 && (
            <div className="glass rounded-2xl p-3 mb-5 border border-white/6">
              <p className="text-[8px] font-black text-white/25 uppercase tracking-widest mb-2">Pendientes:</p>
              <div className="flex flex-wrap gap-1.5">
                {pendingMachines.map(m => (
                  <span key={m.id} className="px-2.5 py-1 glass rounded-lg text-[10px] font-black text-brand-primary/70 border border-brand-primary/20 font-mono-display">
                    #{String(m.number).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <button onClick={onConfirm}
              className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all active:scale-95 btn-brand">
              Sí, Enviar Reporte
            </button>
            <button onClick={onClose}
              className="w-full py-4 glass rounded-2xl font-black text-xs uppercase tracking-widest text-white/40 active:scale-95 transition-all border border-white/8">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Tarjeta de máquina futurista con imagen 3D
───────────────────────────────────────────── */
const MachineCard = ({
  machine, onClick, onCameraClick
}: {
  machine: Machine;
  onClick: () => void;
  onCameraClick: (e: React.MouseEvent) => void;
}) => {
  const d = machine.data;
  let isAlarm = false;
  let val1Real = '--', val1SP = '--', val2Real = '--', val2SP = '--';
  let label1 = 'OVO', label2 = 'AIRE';

  if (machine.status === 'completed' && d) {
    const diff = (r?: string, s?: string) => Math.abs(parseFloat(r || '0') - parseFloat(s || '0'));
    if (machine.type === 'incubadora') {
      val1Real = d.tempOvoscanReal || '--'; val1SP = d.tempOvoscanSP || '--';
      val2Real = d.tempAireReal || '--'; val2SP = d.tempAireSP || '--';
      isAlarm = diff(d.tempOvoscanReal, d.tempOvoscanSP) >= 1.5 || diff(d.tempAireReal, d.tempAireSP) >= 1.5;
    } else {
      label1 = 'SYN'; label2 = 'AIRE';
      val1Real = d.tempSynchroReal || '--'; val1SP = d.tempSynchroSP || '--';
      val2Real = d.temperaturaReal || '--'; val2SP = d.temperaturaSP || '--';
      isAlarm = diff(d.tempSynchroReal, d.tempSynchroSP) >= 1.5 || diff(d.temperaturaReal, d.temperaturaSP) >= 1.5;
    }
  }

  const isPending = machine.status === 'pending';
  const machineCode = String(machine.number).padStart(2, '0');

  return (
    <button
      onClick={onClick}
      disabled={machine.status === 'completed' && !isAlarm}
      className={`relative rounded-2xl overflow-hidden flex flex-col transition-all active:scale-95 min-h-[160px] text-left tap-effect ${
        isPending
          ? 'border border-white/8'
          : isAlarm
          ? 'border border-red-500/50'
          : 'border border-green-500/20'
      }`}
      style={{
        background: 'transparent',
      }}
    >
      {/* Imagen de máquina real */}
      <div className="absolute inset-0">
        <img
          src="/imagen1.png"
          alt={`Máquina ${machineCode}`}
          className="w-full h-full object-cover"
          style={{
            filter: 'brightness(1) contrast(1.05)',
            transform: 'scale(1.02)',
            imageRendering: '-webkit-optimize-contrast',
          }}
        />
        {/* Overlay gradiente sutil solo para legibilidad del texto */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      </div>

      {/* Línea superior de color */}
      <div
        className="absolute top-0 inset-x-0 h-0.5 z-10"
        style={{
          background: isPending
            ? 'linear-gradient(90deg, transparent, rgba(247,147,26,0.6), transparent)'
            : isAlarm
            ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.8), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(34,197,94,0.6), transparent)',
        }}
      />

      {/* Glow de alarma pulsante */}
      {isAlarm && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-pulse-glow"
          style={{ boxShadow: 'inset 0 0 20px rgba(239,68,68,0.25)' }} />
      )}

      {/* Contenido sobre la imagen */}
      <div className="relative z-10 flex flex-col flex-1 p-3.5">
        {/* Número + estado */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className={`text-3xl font-black leading-none machine-number ${
              isPending ? 'text-white/80' : isAlarm ? 'text-red-300' : 'text-green-300'
            }`} style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{machineCode}</span>
            <div className={`text-[7px] font-black uppercase tracking-widest mt-0.5 font-mono-display ${
              isPending ? 'text-white/40' : isAlarm ? 'text-red-300/90' : 'text-green-300/90'
            }`} style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {isPending ? '● PENDIENTE' : isAlarm ? '⚠ ALARMA' : '✓ NORMAL'}
            </div>
          </div>

          {/* Botón de acción */}
          {isPending ? (
            <button
              type="button"
              onClick={onCameraClick}
              className="p-2 rounded-xl transition-all active:scale-90 glow-primary"
              style={{ background: 'linear-gradient(135deg, #f7931a, #ffb800)' }}>
              <Camera size={13} className="text-white" />
            </button>
          ) : (
            <div className={`p-1.5 rounded-xl border ${
              isAlarm ? 'bg-red-500/30 border-red-500/50' : 'bg-green-500/25 border-green-500/40'
            }`} style={{ backdropFilter: 'blur(8px)' }}>
              {isAlarm
                ? <AlertTriangle size={12} className="text-red-300" strokeWidth={2.5} />
                : <CheckCircle2 size={12} className="text-green-300" strokeWidth={2.5} />
              }
            </div>
          )}
        </div>

        {/* Datos de temperatura */}
        {machine.status === 'completed' && d && (
          <div className="mt-auto pt-2.5 border-t grid grid-cols-2 gap-x-2"
            style={{ borderColor: isPending ? 'rgba(255,255,255,0.1)' : isAlarm ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)' }}>
            {[
              { label: label1, real: val1Real, sp: val1SP },
              { label: label2, real: val2Real, sp: val2SP },
            ].map(({ label, real, sp }) => (
              <div key={label}>
                <div className="text-[6px] font-black text-white/40 uppercase tracking-wider font-mono-display" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{label}</div>
                <div className={`text-sm font-black leading-tight ${isAlarm ? 'text-red-200' : 'text-white/90'}`} style={{ textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>
                  {real}°
                  <span className="text-[8px] font-bold text-white/40 ml-0.5">/{sp}°</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Punto de estado para pendientes */}
        {isPending && (
          <div className="mt-auto">
            <div className="text-[7px] text-white/40 font-bold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>Toca para registrar</div>
          </div>
        )}
      </div>
    </button>
  );
};

/* ─────────────────────────────────────────────
   Dashboard principal
───────────────────────────────────────────── */
export default function DashboardScreen({ canAccessSupervisor = false, onSwitchToSupervisor }: { canAccessSupervisor?: boolean; onSwitchToSupervisor?: () => void }) {
  const [activeTab, setActiveTab] = useState<MachineType>('incubadora');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [syncPhase, setSyncPhase] = useState<'uploading' | 'database' | 'pdf'>('uploading');
  const [reportUploaderMachine, setReportUploaderMachine] = useState<Machine | null>(null);
  const [systemTime, setSystemTime] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const theme = useThemeStore(state => state.theme);
  const toggleTheme = useThemeStore(state => state.toggleTheme);
  const isDark = theme === 'dark';

  const machines = useMachineStore(state => state.machines);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const resetHourlyStatus = useMachineStore(state => state.resetHourlyStatus);
  const currentUser = useMachineStore(state => state.currentUser);
  const login = useMachineStore(state => state.login);
  const logout = useMachineStore(state => state.logout);

  // Reloj en tiempo real
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushPendingSyncs();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nota: El polling de sesión (/api/session) ya lo gestiona App.tsx cada 10 segundos.

  // SSE - Escucha permanente de cambios en la DB (para operarios)
  useEffect(() => {
    if (!currentUser) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(getApiUrl('/api/events'));

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.targetUserId && data.targetUserId !== currentUser.id) return;
            // Cuando hay un nuevo reporte, refrescar sesión
            if (data.type === 'NEW_REPORT' || data.type === 'SHIFT_UPDATE') {
              login({ ...currentUser, lastSync: Date.now() });
            }
          } catch {
            // Ignorar
          }
        };

        eventSource.onerror = () => {
          eventSource?.close();
          reconnectTimer = setTimeout(connectSSE, 5000);
        };
      } catch {
        reconnectTimer = setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [currentUser, login]);

  const filteredMachines = machines.filter(m => m.type === activeTab);
  const pendingMachines = machines.filter(m => m.status === 'pending');
  const pendingCount = pendingMachines.length;
  const completedCount = machines.filter(m => m.status === 'completed').length;
  const allCompleted = pendingCount === 0;
  const progress = machines.length > 0 ? Math.round((completedCount / machines.length) * 100) : 0;

  const handleLogout = async () => {
    if (!window.confirm('¿Cerrar turno? Se generará y guardará tu Reporte de Cierre.')) return;
    try {
      setIsSyncing(true); setSyncPhase('pdf');
      const res = await apiFetch(getApiUrl('/api/my-shift-report'));
      if (res.ok) {
        const logs = await res.json();
        if (logs.length > 0) {
          const doc = new jsPDF('landscape');
          doc.setFontSize(16); doc.setTextColor(245, 166, 35);
          doc.text('INCUBANT - REPORTE CIERRE DE TURNO', 14, 15);
          doc.setFontSize(10); doc.setTextColor(40, 40, 40);
          doc.text(`Operario: ${currentUser?.name} | Turno: ${currentUser?.shift || 'Turno 1'}`, 14, 22);
          doc.text(`Fecha: ${new Date().toLocaleString()}`, 14, 27);
          doc.text(`Total registros: ${logs.length}`, 14, 32);
          const tableData = logs.map((log: any) => [
            new Date(log.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            `${log.machine.tipo === 'INCUBADORA' ? 'INC' : 'NAC'}-${log.machine.numero_maquina.toString().padStart(2, '0')}`,
            log.temp_principal_actual?.toFixed(1),
            log.temp_secundaria_actual?.toFixed(1),
            log.co2_actual?.toFixed(1),
            log.observaciones || 'OK'
          ]);
          autoTable(doc, {
            startY: 38,
            head: [['Hora', 'Máquina', 'T. Ovoscan (F)', 'T. Aire (F)', 'Hum/CO2', 'Observaciones']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [245, 166, 35], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
          });
          const pdfBlob = doc.output('blob');
          doc.save(`Cierre_Turno_${currentUser?.name?.replace(/\s+/g, '_')}.pdf`);

          // Upload to backend → Drive folder "Cierres de Turno"
          const formData = new FormData();
          formData.append('evidence', pdfBlob, 'closing_report.pdf');
          const closingRes = await apiFetch(getApiUrl('/api/reports/closing'), {
            method: 'POST',
            body: formData,
          });
          if (closingRes.ok) {
            console.log('[Cierre] PDF subido a Drive exitosamente');
          } else {
            console.warn('[Cierre] Error subiendo PDF, pero se descargó localmente');
          }
        } else {
          alert('Sin registros en el turno. Se cerrará directamente.');
        }
      }
      await apiFetch(getApiUrl('/api/logout'), { method: 'POST' });
    } catch (e) {
      console.error('Error cerrando sesión:', e);
    } finally {
      setIsSyncing(false); logout();
    }
  };

  const handleMachineClick = (machine: Machine) => {
    if (machine.status === 'pending') setActiveMachine(machine.id);
  };

  const handleOpenReportUploader = (e: React.MouseEvent, machine: Machine) => {
    e.stopPropagation(); setReportUploaderMachine(machine);
  };

  const generatePDF = async (syncedMachines: Machine[]): Promise<Blob> => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [245, 166, 35];
    doc.setFontSize(22); doc.setTextColor(...primaryColor); doc.setFont('helvetica', 'bold');
    doc.text('INCUBANT MONITOR', 14, 20);
    doc.setFontSize(12); doc.setTextColor(50, 50, 50);
    doc.text('REPORTE DIARIO DE OPERACIÓN', 14, 28);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString()} | Hora: ${new Date().toLocaleTimeString()}`, 14, 35);
    doc.text(`Operario: ${currentUser?.name || 'Sistema'}`, 14, 40);
    const incs = syncedMachines.filter(m => m.type === 'incubadora');
    const incData = incs.map(m => {
      const d = m.data;
      const time = d?.tiempoIncubacion ? `${d.tiempoIncubacion.dias}d ${d.tiempoIncubacion.horas}h` : '--';
      return [m.number, m.status === 'completed' ? 'OK' : 'APAGADA', time,
        d?.tempOvoscanReal || '--', d?.tempOvoscanSP || '--',
        d?.tempAireReal || '--', d?.tempAireSP || '--',
        d?.humedadReal || '--', d?.co2Real || '--',
        d?.volteoNumero || '--', d?.volteoPosicion || '--',
        d?.alarma || 'No', d?.ventiladorPrincipal || '--',
        m.photoUrl ? 'VER FOTO' : '--', d?.observaciones || ''];
    });
    doc.setFontSize(14); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
    doc.text('CONTROL INCUBADORAS', 14, 55);
    autoTable(doc, {
      startY: 60,
      head: [['N°', 'Est.', 'Tiempo', 'Real', 'SP', 'Aire', 'ASP', 'Hum%', 'CO2', 'V/N', 'V/P', 'Alm', 'Vent', 'Evid.', 'Obs']],
      body: incData, theme: 'grid',
      headStyles: { fillColor: [245, 166, 35] as [number, number, number], textColor: 255, fontSize: 8 },
      styles: { fontSize: 7 },
    });
    const nacs = syncedMachines.filter(m => m.type === 'nacedora');
    const nacData = nacs.map(m => {
      const d = m.data;
      const time = d?.tiempoIncubacion ? `${d.tiempoIncubacion.dias}d ${d.tiempoIncubacion.horas}h` : '--';
      return [m.number, m.status === 'completed' ? 'OK' : 'APAGADA', time,
        d?.tempSynchroReal || '--', d?.tempSynchroSP || '--',
        d?.humedadReal || '--', d?.co2Real || '--',
        d?.ventiladorPrincipal || '--', m.photoUrl ? 'VER FOTO' : '--', d?.observaciones || ''];
    });
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.text('CONTROL NACEDORAS', 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['N°', 'Est.', 'Tiempo', 'Temp', 'SP', 'Hum%', 'CO2', 'Vent', 'Evid.', 'Obs']],
      body: nacData, theme: 'grid',
      headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: 255, fontSize: 8 },
      styles: { fontSize: 8 },
    });
    return doc.output('blob');
  };

  const uploadPDFToDrive = async (pdfBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      await apiFetch(getApiUrl('/api/upload-pdf-drive'), {
        method: 'POST',
        body: JSON.stringify({ pdfBase64: base64 })
      });
    } catch (err) { console.error('PDF Drive upload error:', err); }
  };

  const handleSyncAttempt = () => {
    if (!isOnline) {
      alert('Sin conexión. Los datos se guardan localmente y se sincronizarán cuando haya conexión.');
      // Still allow sync - data is saved locally and will sync when online
    }
    allCompleted ? executeSync() : setShowConfirm(true);
  };

  const executeSync = async () => {
    setShowConfirm(false); setIsSyncing(true); setSyncPhase('uploading');
    try {
      const preparedMachines = machines.map(m => {
        if (m.status === 'pending') return {
          ...m, status: 'completed' as const,
          data: {
            tiempoIncubacion: { dias: '0', horas: '0', minutos: '0' },
            tempOvoscanReal: '0', tempOvoscanSP: '0', tempAireReal: '0', tempAireSP: '0',
            tempSynchroReal: '0', tempSynchroSP: '0', temperaturaReal: '0', temperaturaSP: '0',
            humedadReal: '0', humedadSP: '0', co2Real: '0', co2SP: '0',
            observaciones: 'MÁQUINA APAGADA (Sin registro operario)',
            alarma: 'No' as const, volteoPosicion: '' as const,
            volteoNumero: '0', ventiladorPrincipal: 'No' as const
          }
        };
        return m;
      });

      setSyncPhase('database');

      // Queue data locally if offline
      if (!isOnline) {
        const pendingSync = JSON.parse(localStorage.getItem('incubant-pending-sync') || '[]');
        pendingSync.push({
          userId: currentUser?.id,
          machines: preparedMachines,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('incubant-pending-sync', JSON.stringify(pendingSync));
        setSyncPhase('pdf');
        await generatePDF(preparedMachines);
        setSyncSuccess(true);
        setTimeout(() => { setSyncSuccess(false); resetHourlyStatus(); }, 2000);
        return;
      }

      // Upload photos + data to Drive via backend
      const response = await apiFetch(getApiUrl('/api/sync-hourly-drive'), {
        method: 'POST',
        body: JSON.stringify({ machines: preparedMachines })
      });
      if (!response.ok) throw new Error('Error guardando en servidor');

      setSyncPhase('pdf');
      const pdfBlob = await generatePDF(preparedMachines);
      // Download locally
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_Incubant_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      await uploadPDFToDrive(pdfBlob);
      setSyncSuccess(true);
      setTimeout(() => { setSyncSuccess(false); resetHourlyStatus(); }, 2000);

      // Try to flush pending offline syncs
      await flushPendingSyncs();
    } catch (error) {
      console.error('Error sincronización:', error);
      const pendingSync = JSON.parse(localStorage.getItem('incubant-pending-sync') || '[]');
      pendingSync.push({
        userId: currentUser?.id,
        machines,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('incubant-pending-sync', JSON.stringify(pendingSync));
      alert('Error al sincronizar. Los datos se guardaron localmente y se enviarán cuando haya conexión.');
    } finally { setIsSyncing(false); }
  };

  const flushPendingSyncs = async () => {
    const pendingSync = JSON.parse(localStorage.getItem('incubant-pending-sync') || '[]');
    if (pendingSync.length === 0) return;

    const remaining: any[] = [];
    for (const batch of pendingSync) {
      try {
        const response = await apiFetch(getApiUrl('/api/sync-hourly-drive'), {
          method: 'POST',
          body: JSON.stringify({ machines: batch.machines })
        });
        if (!response.ok) {
          remaining.push(batch);
        }
      } catch {
        remaining.push(batch);
      }
    }
    localStorage.setItem('incubant-pending-sync', JSON.stringify(remaining));
  };

  /* ── Overlay de sincronización futurista ── */
  const syncPhaseInfo = {
    uploading: { label: 'Subiendo Evidencia', icon: UploadCloud, pct: 33 },
    database:  { label: 'Guardando Datos',    icon: Cpu,         pct: 66 },
    pdf:       { label: 'Generando Reporte',  icon: FileText,    pct: 90 },
  };

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${isDark ? '' : 'bg-gray-50'}`} style={isDark ? { background: '#060b18' } : {}}>

      {/* ── Fondo futurista ── */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 circuit-bg opacity-40" />
          <div
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.08) 0%, transparent 65%)' }}
          />
          <div
            className="absolute bottom-32 -left-16 w-56 h-56 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 65%)' }}
          />
        </div>
      )}

      {/* ── Overlay de Sincronización ── */}
      {(isSyncing || syncSuccess) && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="glass-light rounded-3xl p-8 flex flex-col items-center text-center w-full max-w-xs border border-brand-primary/20 relative overflow-hidden">
            {/* Borde superior */}
            <div className="absolute top-0 inset-x-0 h-0.5"
              style={{ background: 'linear-gradient(90deg, transparent, #f7931a, #ffb800, transparent)' }} />

            {isSyncing ? (() => {
              const phase = syncPhaseInfo[syncPhase];
              const PhaseIcon = phase.icon;
              return (
                <>
                  <div className="relative mb-6 w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20 animate-spin-slow" />
                    <div className="absolute inset-[-6px] rounded-full border border-brand-secondary/10 animate-spin-reverse" style={{ borderStyle: 'dashed' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PhaseIcon size={28} className="text-brand-primary animate-pulse-glow" />
                    </div>
                  </div>
                  <h2 className="text-base font-black text-white mb-1 uppercase tracking-wider font-mono-display">
                    {phase.label}
                  </h2>
                  <p className="text-white/30 text-[10px] font-mono mb-5">Procesando datos...</p>
                  <div className="w-full progress-futuristic">
                    <div
                      className="progress-futuristic-bar"
                      style={{ width: `${phase.pct}%`, transition: 'width 0.8s ease' }}
                    />
                  </div>
                  <div className="flex justify-between w-full mt-2">
                    <span className="text-[8px] text-white/20 font-mono">0%</span>
                    <span className="text-[8px] text-brand-primary font-mono font-black">{phase.pct}%</span>
                    <span className="text-[8px] text-white/20 font-mono">100%</span>
                  </div>
                </>
              );
            })() : (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 glow-green"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}>
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-lg font-black text-white mb-1 uppercase font-mono-display">¡Sincronizado!</h2>
                <p className="text-white/30 text-xs font-medium">Reporte generado y guardado.</p>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        onConfirm={executeSync} pendingCount={pendingCount} pendingMachines={pendingMachines}
      />

      {/* ── Header ── */}
      <div className="relative z-10 px-4 pt-12 pb-3 shrink-0">

        {/* HUD top bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center glow-primary shrink-0"
              style={{ background: 'linear-gradient(135deg, #f7931a, #ffb800)' }}
            >
              <Egg size={17} className="text-white" />
            </div>
            <div>
              <div className="text-[7px] font-black text-white/25 uppercase tracking-widest font-mono-display">Operario en Turno</div>
              <div className="text-sm font-black text-white leading-tight flex items-baseline gap-2">
                {currentUser?.name}
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/5 bg-white/5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentUser?.shiftColor || '#f7931a', boxShadow: `0 0 5px ${currentUser?.shiftColor || '#f7931a'}` }} />
                  <span className="text-[8px] font-black font-mono-display text-white/90">
                    {currentUser?.shift || 'T1'}
                  </span>
                  <span className="text-[7px] font-medium font-mono text-white/40">
                    {currentUser?.shiftStart && currentUser?.shiftEnd ? `${currentUser.shiftStart}-${currentUser.shiftEnd}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Panel de Control (solo para admin/supervisor) */}
            {canAccessSupervisor && onSwitchToSupervisor && (
              <button 
                onClick={onSwitchToSupervisor}
                className={`p-2 rounded-xl border flex items-center gap-1 active:scale-95 transition-all ${isDark ? 'glass border-brand-primary/30 text-brand-primary' : 'bg-white border-brand-primary/30 text-brand-primary'}`}
              >
                <Monitor size={14} />
                <span className={`text-[7px] font-black tracking-wider font-mono-display uppercase ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Panel Control</span>
              </button>
            )}
            {/* Reloj */}
            <div className={`rounded-xl px-2.5 py-1.5 border flex items-center gap-1.5 ${isDark ? 'glass border-white/6' : 'bg-white border-gray-200'}`}>
              <Clock size={9} className="text-brand-primary" />
              <span className={`text-[9px] font-black font-mono-display ${isDark ? 'text-white/50' : 'text-gray-600'}`}>{systemTime}</span>
            </div>
            {/* Online/Offline */}
            <div className={`rounded-xl px-2 py-1.5 border flex items-center gap-1 ${isDark ? 'glass border-white/6' : 'bg-white border-gray-200'}`}>
              {isOnline ? <Wifi size={9} className="text-green-400" /> : <WifiOff size={9} className="text-red-400" />}
              <span className={`text-[7px] font-mono uppercase tracking-wider ${isOnline ? 'text-green-400/60' : 'text-red-400/60'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors active:scale-95 ${isDark ? 'glass border-white/6 text-white/30 hover:text-brand-primary' : 'bg-white border-gray-200 text-gray-400 hover:text-brand-primary'}`}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={handleLogout}
              className={`p-2.5 rounded-xl border transition-colors active:scale-95 ${isDark ? 'glass border-white/6 text-white/30 hover:text-red-400' : 'bg-white border-gray-200 text-gray-400 hover:text-red-400'}`}>
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ── Panel de progreso futurista ── */}
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-brand-primary" />
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest font-mono-display">Progreso de Turno</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-brand-primary font-mono-display">{progress}%</span>
              {allCompleted && <div className="status-dot-active" />}
            </div>
          </div>
          <div className="progress-futuristic mb-3">
            <div className="progress-futuristic-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
              <span className="text-[8px] font-black text-white/25 uppercase tracking-wider font-mono-display">
                {pendingCount} Pendientes
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
              <span className="text-[8px] font-black text-white/25 uppercase tracking-wider font-mono-display">
                {completedCount} Completadas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 mb-3 shrink-0 relative z-10">
        <div className="glass flex rounded-xl p-0.5 border border-white/6 gap-0.5">
          {(['incubadora', 'nacedora'] as MachineType[]).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[9px] font-black rounded-[10px] transition-all uppercase tracking-widest font-mono-display ${
                activeTab === tab ? 'text-white' : 'text-white/25 hover:text-white/50'
              }`}
              style={activeTab === tab ? {
                background: 'linear-gradient(135deg, rgba(247,147,26,0.2), rgba(255,184,0,0.12))',
                boxShadow: '0 0 10px rgba(247,147,26,0.15)',
                border: '1px solid rgba(247,147,26,0.25)',
              } : {}}
            >
              {tab === 'incubadora' ? '⬡ Incubadoras' : '⬡ Nacedoras'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Label + Grid de máquinas ── */}
      <div className="flex-1 overflow-y-auto px-4 relative z-10" style={{ paddingBottom: '100px', minHeight: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[8px] font-black text-white/15 uppercase tracking-widest font-mono-display">
            {activeTab === 'incubadora' ? '⬡ INC' : '⬡ NAC'} · {filteredMachines.length} UNIDADES
          </p>
          <div className="flex items-center gap-1">
            <Wifi size={8} className="text-green-400" />
            <span className="text-[7px] text-green-400/60 font-mono uppercase tracking-wider">EN LÍNEA</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {filteredMachines.map(machine => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onClick={() => handleMachineClick(machine)}
              onCameraClick={(e) => handleOpenReportUploader(e, machine)}
            />
          ))}
        </div>
      </div>

      {/* ── Botón Sincronizar ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-6 pt-8"
        style={{ background: 'linear-gradient(to top, #060b18 50%, transparent)' }}>
        <button
          onClick={handleSyncAttempt}
          disabled={isSyncing}
          className="w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3
                     transition-all uppercase tracking-widest active:scale-[0.97]
                     disabled:opacity-40 disabled:cursor-not-allowed font-mono-display"
          style={{
            background: isSyncing
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, #f7931a 0%, #ffb800 100%)',
            boxShadow: isSyncing
              ? 'none'
              : '0 0 30px rgba(247,147,26,0.45), 0 8px 24px rgba(247,147,26,0.3), inset 0 1px 0 rgba(255,220,100,0.25)',
          }}
        >
          {isSyncing
            ? <Loader2 size={18} className="animate-spin text-white/40" />
            : <Zap size={18} className="text-white" />
          }
          <span className={isSyncing ? 'text-white/30' : 'text-white'}>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Operación'}
          </span>
          {!isSyncing && allCompleted && (
            <div className="status-dot-active ml-1" />
          )}
        </button>
      </div>

      {/* Modal ReportUploader */}
      {reportUploaderMachine && (
        <ReportUploader
          machineId={reportUploaderMachine.id}
          machineName={`${reportUploaderMachine.type === 'incubadora' ? 'Incubadora' : 'Nacedora'} #${reportUploaderMachine.number}`}
          onClose={() => setReportUploaderMachine(null)}
          onSuccess={() => setReportUploaderMachine(null)}
        />
      )}
    </div>
  );
}
