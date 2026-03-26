/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import DashboardScreen from './screens/DashboardScreen';
import CameraScreen from './screens/CameraScreen';
import FormScreen from './screens/FormScreen';
import LoginScreen from './screens/LoginScreen';
import SupervisorDashboard from './screens/SupervisorDashboard';
import { useMachineStore } from './store/useMachineStore';
import { canUseSupervisorPanel } from './lib/fallbackAuth';
import { Smartphone, Monitor, Loader2, Wifi, WifiOff } from 'lucide-react';
import { getApiUrl, apiFetch } from './lib/api';

export default function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'supervisor'>('mobile');
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const currentUser = useMachineStore(state => state.currentUser);
  const login = useMachineStore(state => state.login);
  const logout = useMachineStore(state => state.logout);

  const canAccessSupervisor = canUseSupervisorPanel(currentUser?.role);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await apiFetch(getApiUrl('/api/health'));
        if (response.ok) {
          setIsApiHealthy(true);
          return true;
        }
      } catch (err) {
        console.warn('Backend no responde aún, reintentando...');
      }
      setIsApiHealthy(false);
      return false;
    };

    const validateSession = async () => {
      // 1. Esperar a que el API responda (especialmente util para Render cold-starts)
      let healthy = await checkHealth();
      let attempts = 0;
      
      while (!healthy && attempts < 12) { // Intentar por 1 minuto (12 * 5s)
        await new Promise(r => setTimeout(r, 5000));
        healthy = await checkHealth();
        attempts++;
        setRetryCount(attempts);
        if (!isMounted) return;
      }

      if (!healthy) {
        console.error('El servidor central no responde después de varios intentos.');
        // Permitir continuar con fallback local si es necesario, 
        // pero aquí marcamos sessionReady para mostrar el UI
        setIsSessionReady(true);
        return;
      }

      // 2. Si el API está saludable, validar sesión normal
      try {
        const response = await apiFetch(getApiUrl('/api/session'));

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          login(data.user);
        } else if (response.status === 401) {
          logout();
          setViewMode('mobile');
        }
      } catch (error) {
        console.error('Error al validar sesión:', error);
      } finally {
        if (isMounted) {
          setIsSessionReady(true);
        }
      }
    };

    void validateSession();

    return () => {
      isMounted = false;
    };
  }, [login, logout]);

  useEffect(() => {
    if (viewMode === 'supervisor' && !canAccessSupervisor) {
      setViewMode('mobile');
    }
  }, [canAccessSupervisor, viewMode]);

  if (!isSessionReady) {
    const isWaitingApi = isApiHealthy === false;
    
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-xs w-full flex flex-col items-center text-center gap-8">
          <div className="relative">
            <Loader2 size={64} className="animate-spin text-brand-primary opacity-20" />
            <div className="absolute inset-0 flex items-center justify-center">
              {isWaitingApi ? <WifiOff size={32} className="text-orange-500 animate-pulse" /> : <Wifi size={32} className="text-brand-primary animate-pulse" />}
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              {isWaitingApi ? 'Sincronizando Sistemas' : 'Iniciando Monitor'}
            </h2>
            <p className="text-sm text-slate-400 font-medium leading-relaxed">
              {isWaitingApi 
                ? `Estableciendo conexión con el servidor central en Render. Esto puede tomar unos segundos mientras los servicios despiertan (${retryCount}/12).` 
                : 'Validando estado de la sesión y permisos de operario...'}
            </p>
          </div>

          <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-primary transition-all duration-500 ease-out" 
              style={{ width: isWaitingApi ? `${(retryCount / 12) * 100}%` : '40%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'supervisor' && canAccessSupervisor) {
    return (
      <div className="relative h-screen w-full">
        <SupervisorDashboard />
        <button 
          onClick={() => setViewMode('mobile')}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 transition-all"
        >
          <Smartphone size={20} />
          Ver App Operario
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 relative">
      {canAccessSupervisor && (
        <div className="w-full max-w-[400px] flex justify-end mb-4 z-50">
          <button 
            onClick={() => setViewMode('supervisor')}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 font-bold transition-all border border-slate-700"
          >
            <Monitor size={18} className="text-blue-400" />
            Panel Supervisor
          </button>
        </div>
      )}

      <div className="w-full max-w-[400px] h-[800px] max-h-[90vh] bg-black rounded-[3rem] p-2 shadow-2xl relative overflow-hidden ring-4 ring-gray-800">
        <div className="absolute top-0 inset-x-0 h-7 bg-black z-50 rounded-b-3xl w-40 mx-auto flex justify-center items-end pb-1">
          <div className="w-12 h-1.5 bg-gray-800 rounded-full"></div>
        </div>
        
        <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
          {!currentUser ? (
            <LoginScreen />
          ) : activeMachineId ? (
            capturedPhoto ? <FormScreen /> : <CameraScreen />
          ) : (
            <DashboardScreen />
          )}
        </div>
      </div>
    </div>
  );
}
