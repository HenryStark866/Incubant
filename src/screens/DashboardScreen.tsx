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
    <div className="flex flex-col h-full bg-gray-50 pt-6 relative">
      {/* Overlay de Sincronización */}
      {(isSyncing || syncSuccess) && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-8 flex flex-col items-center text-center w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            {isSyncing ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-black text-gray-800 mb-2">Sincronizando...</h2>
                <p className="text-gray-500">Enviando datos de 36 máquinas al servidor</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-black text-gray-800 mb-2">¡Recorrido Exitoso!</h2>
                <p className="text-gray-500">Los datos han sido guardados. Preparando siguiente turno...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-md z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ThermometerSun size={24} />
              AgriMonitor
            </h1>
            <p className="text-xs text-blue-200 mt-1 font-medium">
              Operario: {currentUser?.name}
            </p>
          </div>
          <button 
            onClick={logout}
            className="p-2 bg-blue-700 rounded-full active:bg-blue-800 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-blue-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('incubadora')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'incubadora' ? 'bg-white text-blue-700 shadow' : 'text-blue-100'
            }`}
          >
            Incubadoras (24)
          </button>
          <button
            onClick={() => setActiveTab('nacedora')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'nacedora' ? 'bg-white text-blue-700 shadow' : 'text-blue-100'
            }`}
          >
            Nacedoras (12)
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 p-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex-1 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-3">
          <Clock className="text-red-500" size={24} />
          <div>
            <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Pendientes</p>
            <p className="text-2xl font-black text-red-700 leading-none">{pendingCount}</p>
          </div>
        </div>
        <div className="flex-1 bg-green-50 p-3 rounded-xl border border-green-100 flex items-center gap-3">
          <CheckCircle2 className="text-green-500" size={24} />
          <div>
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Completadas</p>
            <p className="text-2xl font-black text-green-700 leading-none">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        <div className="grid grid-cols-3 gap-3">
          {filteredMachines.map(machine => (
            <button
              key={machine.id}
              onClick={() => handleMachineClick(machine.id, machine.status)}
              className={`relative p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                machine.status === 'completed'
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-200 text-gray-700 shadow-sm hover:border-blue-300'
              }`}
            >
              <span className="text-3xl font-black">{machine.number}</span>
              <span className={`text-[9px] uppercase tracking-wider font-bold ${
                machine.status === 'completed' ? 'text-green-600' : 'text-gray-400'
              }`}>
                {machine.status === 'completed' ? 'Revisada' : 'Pendiente'}
              </span>
              
              {machine.status === 'completed' && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-sm">
                  <CheckCircle2 size={14} strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sync Button */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
        <button 
          onClick={handleSync}
          disabled={!allCompleted || isSyncing}
          className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
            allCompleted 
              ? 'bg-blue-600 text-white active:bg-blue-700 shadow-blue-600/30' 
              : 'bg-gray-200 text-gray-400 shadow-transparent cursor-not-allowed'
          }`}
        >
          <UploadCloud size={22} />
          {allCompleted ? 'Sincronizar y Cerrar Recorrido' : `Faltan ${pendingCount} máquinas`}
        </button>
      </div>
    </div>
  );
}
