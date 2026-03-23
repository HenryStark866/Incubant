import React, { useState } from 'react';
import { useMachineStore } from '../store/useMachineStore';
import { ThermometerSun, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { requestNotificationPermission, scheduleHourlyNotifications } from '../utils/notifications';

export default function LoginScreen() {
  const [operatorId, setOperatorId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const login = useMachineStore(state => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!operatorId || !pin) {
      setError('Por favor ingresa ID y PIN');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: operatorId, pin })
      });

      const data = await response.json();

      if (response.ok) {
        // Request notification permission and schedule
        await requestNotificationPermission();
        scheduleHourlyNotifications();
        
        login(data.user);
      } else {
        setError(data.error || 'Error de autenticación');
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-brand-secondary/30 p-10 flex flex-col items-center justify-center rounded-b-[3rem] relative overflow-hidden border-b-4 border-brand-primary/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_to_bottom_right,rgba(245,166,35,0.1),transparent)] flex items-center justify-center"></div>
        <img src="/logo.png" alt="Incubant Logo" className="w-64 h-auto mb-4 relative z-10" />
        <h1 className="text-xl font-bold text-brand-dark tracking-tight relative z-10 text-center uppercase">Panel de Control de Incubación</h1>
        <p className="text-brand-gray font-semibold mt-1 relative z-10 text-sm">Acceso Restringido</p>
      </div>

      {/* Form */}
      <div className="flex-1 p-8 flex flex-col justify-center max-w-md mx-auto w-full">
        <form onSubmit={handleLogin} className="space-y-8">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-100 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest ml-1">
              ID de Operario
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder=""
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-xl font-bold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-brand-gray uppercase tracking-widest ml-1">
              PIN de Acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-xl font-bold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition-all shadow-sm tracking-[0.5em]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-5 mt-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 bg-brand-primary text-white hover:bg-[#E6951F] active:scale-[0.98] transition-all shadow-xl shadow-brand-primary/30 disabled:bg-gray-300 disabled:shadow-none uppercase tracking-wider"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <LogIn size={24} />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest opacity-50">
            INCUBANT - ANTIOQUEÑA DE INCUBACIÓN S.A.S. © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
