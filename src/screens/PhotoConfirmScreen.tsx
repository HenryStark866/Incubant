import React from 'react';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, Check, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';

export default function PhotoConfirmScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const machines = useMachineStore(state => state.machines);
  
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);
  const saveMachineData = useMachineStore(state => state.saveMachineData);

  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';

  const machine = machines.find(m => m.id === activeMachineId);

  if (!machine || !capturedPhoto) return null;

  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  const handleConfirm = () => {
    // Generate dummy data since form was deleted
    const dummyData = {
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
      volteoNumero: '0',
      volteoPosicion: '' as const,
      alarma: 'No' as const,
      ventiladorPrincipal: 'No' as const,
      observaciones: 'Sin novedades'
    };
    
    // Check if we already have data, otherwise attach dummy
    saveMachineData(machine.id, dummyData, capturedPhoto);
  };

  const handleCancel = () => {
    setCapturedPhoto(null);
    setActiveMachine(null);
  };

  const machineLabel = `${machine.type === 'incubadora' ? 'INC' : 'NAC'}-${String(machine.number).padStart(2, '0')}`;

  return (
    <div className={`flex flex-col h-full relative overflow-hidden font-mono ${isDark ? 'bg-[#060b18]' : 'bg-gray-50'}`}>
      
      {/* Background HUD Layer */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 circuit-bg opacity-20" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 z-10">
        <button
          onClick={handleCancel}
          className={`p-3 rounded-2xl border active:scale-90 transition-all ${isDark ? 'glass border-white/10 text-white/70' : 'bg-white border-gray-200 text-gray-500 shadow-sm'}`}
        >
          <X size={22} />
        </button>
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-brand-primary/90' : 'text-brand-primary'}`}>
            Evidencia Tomada
          </span>
          <div className={`font-black text-xl font-mono-display tracking-wider ${isDark ? 'holo-text' : 'text-gray-900'}`}>
            {machineLabel}
          </div>
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Photo Viewport */}
      <div className="flex-1 relative p-4 z-10 flex flex-col items-center justify-center">
        <div className={`w-full max-w-sm aspect-[3/4] relative rounded-3xl overflow-hidden shadow-2xl border-4 ${isDark ? 'border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : 'border-white shadow-xl'}`}>
          <img 
            src={capturedPhoto} 
            alt="Evidencia" 
            className="w-full h-full object-cover"
          />
          {/* Overlay HUD on photo */}
          {isDark && (
            <div className="absolute inset-0 pointer-events-none box-border border border-brand-primary/30"
                 style={{ boxShadow: 'inset 0 0 40px rgba(247,147,26,0.2)' }} />
          )}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md rounded-lg py-1 px-2 border border-white/20">
              <span className="text-[10px] text-brand-primary font-black tracking-widest">{machineLabel}</span>
            </div>
            <div className="bg-black/50 backdrop-blur-md rounded-lg py-1 px-2 border border-white/20">
              <span className="text-[8px] text-white/80">{new Date().toLocaleTimeString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={`p-6 pb-8 z-10 rounded-t-3xl border-t ${isDark ? 'bg-black/40 backdrop-blur-xl border-white/10' : 'bg-white border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]'}`}>
        
        <h3 className={`text-center font-black uppercase tracking-wider mb-6 font-mono-display ${isDark ? 'text-white' : 'text-gray-800'}`}>
          ¿La imagen es clara?
        </h3>

        <div className="flex gap-4">
          <button
            onClick={handleRetake}
            className={`flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 ${isDark ? 'bg-gray-800/50 border-gray-700 text-white/70 hover:bg-gray-800' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
          >
            <RefreshCw size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">Re-tomar</span>
          </button>
          
          <button
            onClick={handleConfirm}
            className="flex-1 py-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 text-white shadow-xl"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <Check size={28} className="drop-shadow-md" />
            <span className="text-[11px] font-black uppercase tracking-widest drop-shadow-md">Confirmar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
