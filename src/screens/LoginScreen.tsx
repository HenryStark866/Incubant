import React, { useState, useEffect } from 'react';
import { useMachineStore, type User } from '../store/useMachineStore';
import { getApiUrl, apiFetch } from '../lib/api';
import { LogIn, AlertCircle, Loader2, Egg, ShieldCheck, Cpu } from 'lucide-react';
import { requestNotificationPermission, scheduleHourlyNotifications } from '../utils/notifications';

/* ── Partículas flotantes de fondo ── */
const Particle = ({ delay, x, duration }: { delay: number; x: number; duration: number }) => (
  <div
    className="absolute w-px opacity-0"
    style={{
      left: `${x}%`,
      bottom: '-10px',
      height: `${20 + Math.random() * 40}px`,
      background: 'linear-gradient(to top, transparent, rgba(247,147,26,0.6), transparent)',
      animation: `matrix-rain ${duration}s linear ${delay}s infinite`,
    }}
  />
);

/* ── Orbe de energía animado ── */
const EnergyOrb = () => (
  <div className="relative w-24 h-24 flex items-center justify-center">
    {/* Anillos orbitales */}
    <div className="absolute inset-0 rounded-full border border-brand-primary/20 animate-spin-slow" />
    <div
      className="absolute inset-[-6px] rounded-full border border-brand-secondary/10 animate-spin-reverse"
      style={{ borderStyle: 'dashed' }}
    />
    {/* Pulso de fondo */}
    <div
      className="absolute inset-0 rounded-full animate-pulse-glow"
      style={{ background: 'radial-gradient(circle, rgba(247,147,26,0.15) 0%, transparent 70%)' }}
    />
    {/* Ícono central */}
    <div
      className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center glow-primary animate-float"
      style={{ background: 'linear-gradient(135deg, #f7931a 0%, #ffb800 100%)' }}
    >
      <Egg size={32} className="text-white" />
    </div>
    {/* Punto orbital */}
    <div
      className="absolute w-2 h-2 rounded-full bg-brand-secondary animate-orbit"
      style={{ boxShadow: '0 0 8px rgba(255,184,0,0.8)' }}
    />
  </div>
);

export default function LoginScreen() {
  const [operatorId, setOperatorId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [particles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: Math.random() * 8,
      x: (i / 12) * 100 + Math.random() * 8 - 4,
      duration: 6 + Math.random() * 6,
    }))
  );
  const [systemTime, setSystemTime] = useState('');

  const login = useMachineStore(state => state.login);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const completeLogin = async (user: User) => {
    try {
      await requestNotificationPermission().catch(() => null);
      scheduleHourlyNotifications();
    } catch (e) {
      console.warn('Error al iniciar notificaciones:', e);
    } finally {
      login(user);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!operatorId || !pin) { setError('Ingresa tu ID y PIN de acceso'); return; }
    if (pin.length < 4 || pin.length > 8) { setError('El PIN debe tener entre 4 y 8 caracteres.'); return; }

    setIsLoading(true);
    try {
      const response = await apiFetch(getApiUrl('/api/login'), {
        method: 'POST',
        body: JSON.stringify({ id: operatorId, pin })
      });
      const data = await response.json();
      if (response.ok) {
        await completeLogin(data.user);
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Sin conexión con el servidor. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden relative" style={{ background: '#060b18' }}>

      {/* ── Fondo multi-capa futurista ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Grid de circuito */}
        <div className="absolute inset-0 circuit-bg opacity-60" />

        {/* Orbes de luz */}
        <div
          className="absolute -top-40 -left-20 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(247,147,26,0.12) 0%, transparent 65%)',
            animation: 'float-slow 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-24 right-0 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 65%)',
            animation: 'float-slow 10s ease-in-out 2s infinite',
          }}
        />

        {/* Línea horizontal de escaneo */}
        <div
          className="absolute inset-x-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(247,147,26,0.5) 30%, rgba(247,147,26,0.8) 50%, rgba(247,147,26,0.5) 70%, transparent 100%)',
            animation: 'scan-line 6s ease-in-out infinite',
            top: '40%',
          }}
        />

        {/* Partículas */}
        {particles.map(p => <Particle key={p.id} delay={p.delay} x={p.x} duration={p.duration} />)}
      </div>

      {/* ── Barra superior HUD ── */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-12 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="status-dot-active" />
          <span className="text-[9px] font-mono text-green-400/70 uppercase tracking-widest">SISTEMA ACTIVO</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu size={10} className="text-brand-primary/50" />
          <span className="font-mono text-[9px] text-brand-primary/50 tracking-widest animate-blink">{systemTime}</span>
        </div>
        <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest">v0.1.1</div>
      </div>

      {/* ── Hero / Logo ── */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-6 pb-8 px-6 shrink-0 animate-slide-down">
        <EnergyOrb />

        <div className="mt-6 text-center">
          <h1
            className="text-5xl font-black tracking-tighter leading-none font-mono-display"
            style={{
              background: 'linear-gradient(135deg, #f7931a 0%, #ffb800 50%, #fff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            INCUBANT
          </h1>
          <p className="text-[9px] font-bold text-brand-primary/60 tracking-[0.4em] uppercase mt-2">
            Antioqueña de Incubación S.A.S.
          </p>
        </div>

        {/* Badge de acceso */}
        <div className="mt-5 flex items-center gap-2 px-4 py-2 rounded-full glass border border-brand-primary/20">
          <ShieldCheck size={11} className="text-brand-primary" />
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.2em]">
            Acceso Restringido · Operarios
          </span>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-8" style={{ minHeight: 0 }}>
        <div className="max-w-sm mx-auto">
          <form onSubmit={handleLogin} className="space-y-4">

            {/* Error banner */}
            {error && (
              <div className="rounded-2xl p-4 flex items-center gap-3 border border-red-500/30 animate-slide-up"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <AlertCircle size={16} className="shrink-0 text-red-400" />
                <p className="text-xs font-bold text-red-400">{error}</p>
              </div>
            )}

            {/* ID de Operario */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] ml-1 flex items-center gap-1.5">
                <span className="text-brand-primary">▸</span> ID de Operario
              </label>
              <div className="glass-card rounded-2xl p-4 border border-white/8 tap-effect hud-corners">
                <input
                  type="text"
                  value={operatorId}
                  onChange={e => setOperatorId(e.target.value)}
                  placeholder="Ej: 001"
                  className="w-full bg-transparent text-2xl font-black text-white placeholder:text-white/15
                             focus:outline-none font-mono-display tracking-wider"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] ml-1 flex items-center gap-1.5">
                <span className="text-brand-primary">▸</span> PIN de Acceso
              </label>
              <div className="glass-card rounded-2xl p-4 border border-white/8 tap-effect hud-corners">
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-transparent text-2xl font-black text-white placeholder:text-white/20
                             tracking-[0.5em] focus:outline-none"
                />
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 mt-2 rounded-2xl font-black text-[13px] flex items-center justify-center gap-3
                         uppercase tracking-widest active:scale-[0.97] transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed btn-brand"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center space-y-2">
            <div className="flex items-center gap-2 justify-center">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/10" />
              <span className="text-[8px] text-white/15 font-mono uppercase tracking-widest px-2">SYS</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <p className="text-[8px] text-white/15 font-mono uppercase tracking-widest">
              INCUBANT © 2026 · Antioqueña de Incubación S.A.S.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
