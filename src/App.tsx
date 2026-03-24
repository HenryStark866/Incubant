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
import { Smartphone, Monitor, Loader2 } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'supervisor'>('mobile');
  const [isSessionReady, setIsSessionReady] = useState(false);
  
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const currentUser = useMachineStore(state => state.currentUser);
  const login = useMachineStore(state => state.login);
  const logout = useMachineStore(state => state.logout);

  const canAccessSupervisor = currentUser?.role === 'JEFE' || currentUser?.role === 'SUPERVISOR';

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      try {
        const response = await fetch('/api/session');

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          login(data.user);
          return;
        }

        logout();
        setViewMode('mobile');
      } catch {
        if (!isMounted) {
          return;
        }

        logout();
        setViewMode('mobile');
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
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 size={40} className="animate-spin text-brand-primary" />
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Validando sesión</p>
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative">
      {canAccessSupervisor && (
        <button 
          onClick={() => setViewMode('supervisor')}
          className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 font-bold z-50 transition-all border border-slate-700"
        >
          <Monitor size={20} className="text-blue-400" />
          Panel Supervisor
        </button>
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
