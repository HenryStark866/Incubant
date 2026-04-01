import { useEffect, useState, useRef, useCallback } from 'react';
import DashboardScreen from './screens/DashboardScreen';
import CameraScreen from './screens/CameraScreen';
import FormScreen from './screens/FormScreen';
import LoginScreen from './screens/LoginScreen';
import SupervisorDashboard from './screens/SupervisorDashboard';
import UpdatePrompt from './components/UpdatePrompt';
import { useMachineStore } from './store/useMachineStore';
import { useThemeStore } from './store/useThemeStore';
import { canUseSupervisorPanel } from './lib/fallbackAuth';
import { Smartphone, Monitor, Loader2, Wifi, WifiOff, Cpu, Sun, Moon } from 'lucide-react';
import { getApiUrl, apiFetch } from './lib/api';

export default function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'supervisor'>('mobile');
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isApiHealthy, setIsApiHealthy] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const theme = useThemeStore(state => state.theme);
  const toggleTheme = useThemeStore(state => state.toggleTheme);
  const isDark = theme === 'dark';
  
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const currentUser = useMachineStore(state => state.currentUser);
  const login = useMachineStore(state => state.login);
  const logout = useMachineStore(state => state.logout);

  const canAccessSupervisor = canUseSupervisorPanel(currentUser?.role);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
        console.warn('Backend offline, retrying...');
      }
      setIsApiHealthy(false);
      return false;
    };

    const validateSession = async () => {
      let healthy = await checkHealth();
      let attempts = 0;
      
      while (!healthy && attempts < 12) {
        await new Promise(r => setTimeout(r, 5000));
        healthy = await checkHealth();
        attempts++;
        setRetryCount(attempts);
        if (!isMounted) return;
      }

      if (healthy) {
        try {
          const response = await apiFetch(getApiUrl('/api/session'));
          if (isMounted) {
            if (response.ok) {
              const data = await response.json();
              login(data.user);
            } else if (response.status === 401) {
              logout();
              setViewMode('mobile');
            }
          }
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }
      
      if (isMounted) setIsSessionReady(true);
    };

    void validateSession();
    return () => { isMounted = false; };
  }, [login, logout]);

  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!currentUser) return;
    
    const syncProfile = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const res = await apiFetch(getApiUrl('/api/session'));
        if (res.ok) {
          const { user } = await res.json();
          if (user && JSON.stringify(user) !== JSON.stringify(currentUser)) {
            if (user.shift !== currentUser.shift) {
               try {
                  const { showAppNotification } = await import('./utils/notifications');
                  void showAppNotification('¡Cambio de Turno!', {
                    body: `Has sido reasignado al ${user.shift}.`,
                    icon: '/pwa-192x192.png'
                  });
               } catch (notifErr) { console.warn('Notificaciones no disponibles'); }
            }
            login(user);
          }
        } else if (res.status === 401) {
          logout();
        }
      } catch (err) {
        /* Silencioso */
      } finally {
        isSyncingRef.current = false;
      }
    };

    const interval = setInterval(syncProfile, 1000);
    return () => clearInterval(interval);
  }, [currentUser, login, logout]);

  // Solo auto-cambiar a supervisor en el login inicial, NO cuando el usuario cambia manualmente
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (!isSessionReady || !canAccessSupervisor) return;
    if (!hasAutoSwitchedRef.current) {
      hasAutoSwitchedRef.current = true;
      setViewMode('supervisor');
    }
  }, [canAccessSupervisor, isSessionReady]);

  const handleSwitchToMobile = useCallback(() => {
    hasAutoSwitchedRef.current = false;
    setViewMode('mobile');
  }, []);

  const handleSwitchToSupervisor = useCallback(() => {
    hasAutoSwitchedRef.current = true;
    setViewMode('supervisor');
  }, []);

  if (!isSessionReady) {
    const isWaitingApi = isApiHealthy === false;
    return (
      <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-8 relative overflow-hidden font-mono">
        <div className="absolute inset-0 circuit-bg opacity-20 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-brand-primary blur-[160px] opacity-10 animate-float-slow" />
        
        <div className="max-w-xs w-full flex flex-col items-center text-center gap-10 relative z-10">
          <div className="relative w-32 h-32 flex items-center justify-center">
             <div className="absolute inset-0 rounded-full border-2 border-brand-primary/20 animate-spin-slow" />
             <div className="absolute inset-[-8px] rounded-full border border-brand-secondary/10 animate-spin-reverse" style={{ borderStyle: 'dashed' }} />
             <div className="absolute inset-0 animate-pulse-glow rounded-full" style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.1) 0%, transparent 70%)' }} />
             
             <div className="relative z-10 w-24 h-24 flex items-center justify-center animate-float">
                <img src="/LOGO.png" alt="Incubant" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(247,147,26,0.5)]" />
             </div>
          </div>
          
          <div className="space-y-4">
             <div className="flex items-center justify-center gap-2 mb-2">
                <Cpu size={12} className="text-brand-primary animate-blink" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-brand-primary/60 font-mono-display">Corporacion CDH Maker</span>
             </div>
             <h2 className="text-2xl font-black text-white tracking-widest uppercase font-mono-display holo-text">
               INICIANDO APP INCUBANT
             </h2>
             <div className="h-px w-20 bg-brand-primary/20 mx-auto" />
             <p className="text-[10px] text-white/30 font-medium leading-relaxed uppercase tracking-widest max-w-[200px] mx-auto font-mono">
               {isWaitingApi 
                 ? `Estableciendo enlace seguro con el nucleo central. Intento ${retryCount}/12` 
                 : 'Cargando protocolos de seguridad y validando sesion de operario...'}
             </p>
          </div>

          <div className="w-full space-y-2">
            <div className="w-full bg-white/5 h-[3px] rounded-full overflow-hidden relative border border-white/5">
              <div 
                className="h-full bg-brand-primary transition-all duration-700 ease-out shadow-[0_0_15px_rgba(247,147,26,0.8)]"
                style={{ width: isWaitingApi ? `${(retryCount / 12) * 100}%` : '45%' }}
              />
            </div>
            <div className="flex justify-between text-[7px] font-black text-white/20 tracking-tighter font-mono uppercase">
               <span>BITRATE: 104.22 KB/S</span>
               <span>{isWaitingApi ? (retryCount*8.3).toFixed(1) : '45.0'}%</span>
               <span>STATUS: {isWaitingApi ? 'PENDING' : 'READY'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'supervisor' && canAccessSupervisor) {
    return (
      <div className={`relative h-screen w-full font-sans flex flex-col ${isDark ? 'bg-[#060b18]' : 'bg-gray-50'}`}>
        <div className="flex-1 overflow-hidden relative">
           <SupervisorDashboard />
        </div>
        
        {/* Botón flotante para cambiar a vista de operario - integrado en el diseño */}
        <button 
          onClick={handleSwitchToMobile}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 border-2 px-5 py-3 rounded-2xl font-bold text-xs shadow-xl transition-all active:scale-95 ${isDark ? 'bg-white/10 border-brand-primary/20 text-white hover:bg-brand-primary hover:text-white hover:border-brand-primary' : 'bg-white border-brand-primary/20 text-brand-dark hover:bg-brand-primary hover:text-white hover:border-brand-primary'}`}
        >
          <Smartphone size={16} />
          <span>Vista Operario</span>
        </button>
        
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`fixed bottom-6 right-32 z-50 flex items-center gap-2 border-2 px-4 py-3 rounded-2xl font-bold text-xs shadow-xl transition-all active:scale-95 ${isDark ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full w-full relative flex flex-col items-center justify-center overscroll-none overflow-hidden font-mono ${isDark ? 'bg-[#060b18]' : 'bg-gray-50'}`}>
      <UpdatePrompt />
      
      {canAccessSupervisor && (
        <div className="fixed top-4 right-4 z-[100] animate-fade-in">
          <button 
            onClick={handleSwitchToSupervisor}
            className={`px-4 py-3 rounded-2xl border flex items-center gap-3 active:scale-95 transition-all shadow-2xl hover:bg-white/5 ${isDark ? 'glass-dark border-brand-primary/30' : 'bg-white border-brand-primary/30'}`}
          >
            <div className="relative">
               <Monitor size={16} className="text-brand-primary" />
               <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-primary rounded-full animate-pulse-glow" />
            </div>
            <span className={`text-[10px] font-black tracking-widest font-mono-display uppercase ${isDark ? 'text-white/60' : 'text-gray-600'}`}>SISTEMA_ADMIN</span>
          </button>
        </div>
      )}

      <div className={`w-full h-full relative overflow-hidden safe-top safe-bottom ${isDark ? 'bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)]' : 'bg-white shadow-[0_0_100px_rgba(0,0,0,0.15)]'}`}>
        {!currentUser ? (
          <LoginScreen />
        ) : activeMachineId && capturedPhoto ? (
          <FormScreen />
        ) : activeMachineId ? (
          <CameraScreen />
        ) : (
          <DashboardScreen />
        )}
      </div>
    </div>
  );
}
