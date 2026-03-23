import React, { useState } from 'react';
import { useMachineStore, MachineType } from '../store/useMachineStore';
import { CheckCircle2, Clock, UploadCloud, Loader2, LogOut, ChevronRight, Egg } from 'lucide-react';

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
    <div className="flex flex-col h-full bg-[#F5F5F7] relative font-sans">
      {/* Overlay de Sincronización */}
      {(isSyncing || syncSuccess) && (
        <div className="absolute inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-10 flex flex-col items-center text-center w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            {isSyncing ? (
              <>
                <Loader2 className="w-16 h-16 text-[#F5A623] animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Sincronizando...</h2>
                <p className="text-gray-500 font-medium">Actualizando registros en la nube</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">¡Completado!</h2>
                <p className="text-gray-500 font-medium">Los datos se han guardado correctamente.</p>
              </>
            )}
          </div>
        </div>
      )}

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
              <p className="text-sm font-bold text-[#1A1A1A]">{currentUser?.name}</p>
            </div>
          </div>
          <button 
            onClick={logout}
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
          {filteredMachines.map(machine => (
            <button
              key={machine.id}
              onClick={() => handleMachineClick(machine.id, machine.status)}
              disabled={machine.status === 'completed'}
              className={`relative p-4 rounded-2xl border flex flex-row items-center justify-between transition-all active:scale-95 ${
                machine.status === 'completed'
                  ? 'bg-green-50/50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-[#1A1A1A] shadow-sm hover:border-[#F5A623]/50'
              }`}
            >
              <div className="flex flex-col items-start gap-1">
                <span className="text-2xl font-black tracking-tight">{machine.number}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  machine.status === 'completed' ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {machine.status === 'completed' ? 'Revisada' : 'Pendiente'}
                </span>
              </div>
              
              {machine.status === 'completed' ? (
                <div className="bg-white rounded-full p-1 shadow-sm border border-green-100">
                  <CheckCircle2 size={16} className="text-green-500" strokeWidth={3} />
                </div>
              ) : (
                <ChevronRight size={20} className="text-gray-300" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Botón de Sincronización */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#F5F5F7] via-[#F5F5F7] to-transparent z-20">
        <button 
          onClick={handleSync}
          disabled={!allCompleted || isSyncing}
          className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all uppercase tracking-wide ${
            allCompleted 
              ? 'bg-[#F5A623] text-white active:bg-[#e0961d] shadow-lg shadow-[#F5A623]/30' 
              : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
          }`}
        >
          <UploadCloud size={22} />
          {allCompleted ? 'Sincronizar Datos' : `Faltan ${pendingCount} revisiones`}
        </button>
      </div>
    </div>
  );
}

