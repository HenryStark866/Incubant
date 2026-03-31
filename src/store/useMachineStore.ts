import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type MachineType = 'incubadora' | 'nacedora';
export type MachineStatus = 'pending' | 'completed';
export type UserRole = 'OPERARIO' | 'SUPERVISOR' | 'JEFE';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  shift?: string;
  shiftColor?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

export interface MachineData {
  tiempoIncubacion: {
    dias: string;
    horas: string;
    minutos: string;
  };
  // Para Incubadoras
  tempOvoscanReal?: string;
  tempOvoscanSP?: string;
  tempAireReal?: string;
  tempAireSP?: string;
  
  // Para Nacedoras
  tempSynchroReal?: string;
  tempSynchroSP?: string;
  temperaturaReal?: string; // Aire en nacedoras
  temperaturaSP?: string;

  // Comunes
  humedadReal?: string;
  humedadSP?: string;
  co2Real?: string;
  co2SP?: string;
  
  volteoNumero?: string;
  volteoPosicion?: 'V' | 'A' | '';
  alarma?: 'Si' | 'No';
  humedadRelativa?: string; // Legacy
  temperatura?: string; // Legacy
  co2?: string; // Legacy
  
  observaciones: string;
  ventiladorPrincipal?: 'Si' | 'No';
}

export interface Machine {
  id: string;
  type: MachineType;
  number: number;
  status: MachineStatus;
  lastChecked: string | null;
  data?: MachineData;
  photoUrl?: string;
}

interface MachineState {
  machines: Machine[];
  activeMachineId: string | null;
  capturedPhoto: string | null;
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;
  setActiveMachine: (id: string | null) => void;
  setCapturedPhoto: (photo: string | null) => void;
  saveMachineData: (id: string, data: MachineData, photoUrl: string) => void;
  autoReportMachine: (id: string, photoUrl: string) => void;
  resetHourlyStatus: () => void;
}

// Generar datos iniciales
const generateInitialMachines = (): Machine[] => {
  const machines: Machine[] = [];
  for (let i = 1; i <= 24; i++) {
    machines.push({ id: `inc-${i}`, type: 'incubadora', number: i, status: 'pending', lastChecked: null });
  }
  for (let i = 1; i <= 12; i++) {
    machines.push({ id: `nac-${i}`, type: 'nacedora', number: i, status: 'pending', lastChecked: null });
  }
  return machines;
};

export const useMachineStore = create<MachineState>()(
  persist(
    (set) => ({
      machines: generateInitialMachines(),
      activeMachineId: null,
      capturedPhoto: null,
      currentUser: null,
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
      setActiveMachine: (id) => set({ activeMachineId: id, capturedPhoto: null }),
      setCapturedPhoto: (photo) => set({ capturedPhoto: photo }),
      saveMachineData: (id, data, photoUrl) => set((state) => ({
        machines: state.machines.map(m => 
          m.id === id 
            ? { ...m, status: 'completed', lastChecked: new Date().toISOString(), data, photoUrl } 
            : m
        ),
        activeMachineId: null,
        capturedPhoto: null
      })),
      autoReportMachine: (id: string, photoUrl: string) => set((state) => ({
        machines: state.machines.map(m => 
          m.id === id 
            ? { ...m, status: 'completed', lastChecked: new Date().toISOString(), photoUrl } 
            : m
        ),
        activeMachineId: null,
        capturedPhoto: null
      })),
      resetHourlyStatus: () => set((state) => ({
        machines: state.machines.map(m => ({ ...m, status: 'pending', lastChecked: null, data: undefined, photoUrl: undefined }))
      }))
    }),
    {
      name: 'agrimonitor-storage',
      storage: createJSONStorage(() => localStorage),
      // Omitir el estado temporal de la persistencia
      partialize: (state) => ({ machines: state.machines, currentUser: state.currentUser }),
    }
  )
);
