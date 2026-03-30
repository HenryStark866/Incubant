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
import UpdatePrompt from './components/UpdatePrompt';
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
    // Auto-navegar al panel de administrador instantáneamente si el usuario es supervisor
    if (canAccessSupervisor && viewMode === 'mobile') {
      setViewMode('supervisor');
    }
  }, [canAccessSupervisor]);

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
    <div className="h-full w-full bg-slate-50 relative flex flex-col items-center justify-center overscroll-none overflow-hidden">
      <UpdatePrompt />
      
      {/* Botón flotante para supervisores en modo móvil si es necesario */}
      {canAccessSupervisor && (
        <div className="fixed top-6 right-6 z-[100]">
          <button 
            onClick={() => setViewMode('supervisor')}
            className="bg-brand-dark/80 backdrop-blur-md hover:bg-brand-dark text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-black transition-all border border-white/10 active:scale-95"
          >
            <Monitor size={18} className="text-brand-primary" />
            PANEL ADMIN
          </button>
        </div>
      )}

      <div className="w-full h-full relative overflow-hidden bg-white safe-top safe-bottom">
        {!currentUser ? (
          <LoginScreen />
        ) : activeMachineId ? (
          <CameraScreen />
        ) : (
          <DashboardScreen />
        )}
      </div>
    </div>
  );
}
