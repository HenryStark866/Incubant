import React, { useState } from 'react';
import { useMachineStore, MachineType } from '../store/useMachineStore';
import { CheckCircle2, Clock, ThermometerSun, UploadCloud, Loader2, LogOut } from 'lucide-react';

export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<MachineType>('incubadora');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  const machines = useMachineStore(state => state.machines);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const resetHourlyStatus = useMachineStore(state => state.resetHourlyStatus);
  const currentUser = useMachineStore(state => state.currentUser);
  const logout = useMachineStore(state => state.logout);

  const filteredMachines = machines.filter(m => m.type === activeTab);

  const pendingCount = machines.filter(m => m.status === 'pending').length;
  const completedCount = machines.filter(m => m.status === 'completed').length;
  const allCompleted = pendingCount === 0;

  const handleMachineClick = (machineId: string, status: string) => {
    if (status === 'pending') {
      setActiveMachine(machineId);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      // 1. Upload images to Supabase
      const { uploadEvidenceImage } = await import('../lib/supabase');
      
      const machinesWithUploadedPhotos = await Promise.all(
        machines.map(async (machine) => {
          if (machine.status === 'completed' && machine.photoUrl && machine.photoUrl.startsWith('data:image')) {
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
      const response = await fetch('/api/sync-hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          machines: machinesWithUploadedPhotos
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar los datos en el servidor');
      }

      setSyncSuccess(true);
      setTimeout(() => {
        setSyncSuccess(false);
        resetHourlyStatus();
      }, 2000);

    } catch (error) {
      console.error("Error de sincronización:", error);
      alert("Hubo un error al sincronizar los datos. Por favor, inténtalo de nuevo.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Overlay de Sincronización */}
      {(isSyncing || syncSuccess) && (
        <div className="absolute inset-0 z-50 bg-brand-dark/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] p-10 flex flex-col items-center text-center w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 border-2 border-brand-primary/10">
            {isSyncing ? (
              <>
                <Loader2 className="w-20 h-20 text-brand-primary animate-spin mb-6" />
                <h2 className="text-2xl font-black text-brand-dark mb-2">Sincronizando...</h2>
                <p className="text-brand-gray font-medium">Actualizando registros en la nube</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-2">¡Completado!</h2>
                <p className="text-brand-gray font-medium">Los datos se han guardado correctamente.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-brand-secondary/20 p-5 border-b-2 border-brand-primary/10 z-10">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Incubant" className="h-10 w-auto" />
            <div className="h-8 w-[2px] bg-brand-primary/20 mx-1"></div>
            <div>
              <p className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Operario</p>
              <p className="text-sm font-black text-brand-dark leading-none">{currentUser?.name}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-3 bg-white text-brand-gray rounded-2xl hover:text-red-500 transition-colors shadow-sm border border-gray-100 active:scale-90"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/50 rounded-2xl p-1.5 border border-gray-100 shadow-inner">
          <button
            onClick={() => setActiveTab('incubadora')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'incubadora' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' : 'text-brand-gray hover:text-brand-dark'
            }`}
          >
            Incubadoras (24)
          </button>
          <button
            onClick={() => setActiveTab('nacedora')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'nacedora' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]' : 'text-brand-gray hover:text-brand-dark'
            }`}
          >
            Nacedoras (12)
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 p-5 bg-white border-b border-gray-100 shadow-sm z-10">
        <div className="flex-1 bg-brand-secondary/5 p-4 rounded-2xl border border-brand-secondary/20 flex items-center gap-4">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <Clock className="text-brand-primary" size={20} />
          </div>
          <div>
            <p className="text-[9px] text-brand-gray font-bold uppercase tracking-widest">Pendientes</p>
            <p className="text-2xl font-black text-brand-dark leading-none">{pendingCount}</p>
          </div>
        </div>
        <div className="flex-1 bg-green-50/50 p-4 rounded-2xl border border-green-100 flex items-center gap-4">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <CheckCircle2 className="text-green-500" size={20} />
          </div>
          <div>
            <p className="text-[9px] text-brand-gray font-bold uppercase tracking-widest">Revisadas</p>
            <p className="text-2xl font-black text-brand-dark leading-none">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-5 pb-32">
        <div className="grid grid-cols-3 gap-4">
          {filteredMachines.map(machine => (
            <button
              key={machine.id}
              onClick={() => handleMachineClick(machine.id, machine.status)}
              className={`relative p-5 rounded-[1.8rem] border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                machine.status === 'completed'
                  ? 'bg-green-50/30 border-green-500/50 text-green-700 shadow-sm shadow-green-100'
                  : 'bg-white border-gray-100 text-brand-dark shadow-sm hover:border-brand-primary/30'
              }`}
            >
              <span className="text-3xl font-black tracking-tighter">{machine.number}</span>
              <span className={`text-[8px] uppercase font-black tracking-widest ${
                machine.status === 'completed' ? 'text-green-600' : 'text-brand-gray opacity-60'
              }`}>
                {machine.status === 'completed' ? 'OK' : 'VER'}
              </span>
              
              {machine.status === 'completed' && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 shadow-md">
                  <CheckCircle2 size={12} strokeWidth={4} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sync Button */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-white/80 backdrop-blur-md border-t border-gray-100 shadow-[0_-15px_30px_rgba(0,0,0,0.03)] z-20">
        <button 
          onClick={handleSync}
          disabled={!allCompleted || isSyncing}
          className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl uppercase tracking-widest ${
            allCompleted 
              ? 'bg-brand-primary text-white active:bg-[#E6951F] shadow-brand-primary/30' 
              : 'bg-gray-100 text-brand-gray/40 shadow-none cursor-not-allowed border border-gray-100'
          }`}
        >
          <UploadCloud size={24} />
          {allCompleted ? 'Finalizar Recorrido' : `Pendientes: ${pendingCount}`}
        </button>
      </div>
    </div>
  );
}
