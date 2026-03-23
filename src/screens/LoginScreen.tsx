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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-8 shadow-md flex flex-col items-center justify-center rounded-b-[2.5rem] relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-700 opacity-20 pattern-diagonal-lines"></div>
        <ThermometerSun size={64} className="mb-4 relative z-10" />
        <h1 className="text-3xl font-black tracking-tight relative z-10">AgriMonitor</h1>
        <p className="text-blue-200 font-medium mt-2 relative z-10">Control de Incubación</p>
      </div>

      {/* Form */}
      <div className="flex-1 p-6 flex flex-col justify-center">
        <form onSubmit={handleLogin} className="space-y-6">
          
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-red-200 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
              ID de Operario
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="Ej: 1"
              className="w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
              PIN de Acceso (4 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="****"
              className="w-full bg-white border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm tracking-[0.5em]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 mt-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-blue-600 text-white active:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 disabled:bg-blue-400 disabled:shadow-none"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <LogIn size={24} />
                Ingresar al Turno
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 font-medium">
            Usa ID: <span className="font-bold text-gray-600">1</span> y PIN: <span className="font-bold text-gray-600">1234</span> para probar
          </p>
        </div>
      </div>
    </div>
  );
}
