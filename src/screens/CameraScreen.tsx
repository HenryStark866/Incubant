import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, X, FlipHorizontal, Loader2, AlertTriangle, Cpu, Shield } from 'lucide-react';

type CameraStatus = 'loading' | 'ready' | 'error';

export default function CameraScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);
  const machines = useMachineStore(state => state.machines);

  const machine = machines.find(m => m.id === activeMachineId);
  const webcamRef = useRef<Webcam>(null);

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('loading');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCapturing, setIsCapturing] = useState(false);
  const [systemTime, setSystemTime] = useState('');

  useEffect(() => {
    const tick = () => {
      setSystemTime(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCameraReady = () => setCameraStatus('ready');
  const handleCameraError = (err: string | DOMException) => {
    console.error('Error de cámara:', err);
    setCameraStatus('error');
  };

  const flipCamera = () => {
    setCameraStatus('loading');
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capture = () => {
    if (isCapturing || cameraStatus !== 'ready') return;
    const image = webcamRef.current?.getScreenshot();
    if (!image || !activeMachineId) return;

    setIsCapturing(true);
    navigator.vibrate?.([50, 30, 50]);
    setTimeout(() => { setCapturedPhoto(image); }, 200);
  };

  if (!machine) return null;
  const machineLabel = `${machine.type === 'incubadora' ? 'INC' : 'NAC'}-${String(machine.number).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-black text-white relative overscroll-none overflow-hidden font-mono">
      {/* ── Background HUD Layer ── */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute inset-0 circuit-bg opacity-20" />
        {/* Corner Marks */}
        <div className="absolute top-10 left-6 w-12 h-12 border-t-2 border-l-2 border-brand-primary/40 rounded-tl-xl" />
        <div className="absolute top-10 right-6 w-12 h-12 border-t-2 border-r-2 border-brand-primary/40 rounded-tr-xl" />
        <div className="absolute bottom-40 left-6 w-12 h-12 border-b-2 border-l-2 border-brand-primary/40 rounded-bl-xl" />
        <div className="absolute bottom-40 right-6 w-12 h-12 border-b-2 border-r-2 border-brand-primary/40 rounded-br-xl" />
      </div>

      {/* ── Header ── */}
      <div className="absolute top-10 inset-x-0 flex items-center justify-between px-6 z-30">
        <button
          onClick={() => setActiveMachine(null)}
          className="p-3 glass rounded-2xl border border-white/10 active:scale-90 transition-all"
        >
          <X size={22} className="text-white/70" />
        </button>

        <div className="flex flex-col items-center">
          <div className="glass px-4 py-1.5 rounded-full border border-brand-primary/30 flex items-center gap-2 mb-1">
            <Shield size={10} className="text-brand-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary/90">Registro de Evidencia</span>
          </div>
          <div className="font-black text-xl font-mono-display tracking-wider holo-text">{machineLabel}</div>
        </div>

        <button
          onClick={flipCamera}
          disabled={cameraStatus === 'error'}
          className="p-3 glass rounded-2xl border border-white/10 active:scale-90 transition-all disabled:opacity-20"
        >
          <FlipHorizontal size={22} className="text-white/70" />
        </button>
      </div>

      {/* ── System Stats ── */}
      <div className="absolute top-28 left-6 z-30 flex flex-col gap-1 opacity-40">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-brand-primary" />
          <span className="text-[7px] font-bold">POS_X: 104.22</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-brand-primary" />
          <span className="text-[7px] font-bold">SYSTEM_T: {systemTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-brand-primary" />
          <span className="text-[7px] font-bold">REC_LINK: SECURE</span>
        </div>
      </div>

      {/* ── Camera Viewport ── */}
      <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          videoConstraints={{ facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }}
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          playsInline
          className="w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: cameraStatus === 'ready' ? 1 : 0 }}
        />

        {/* Loading / Ready State Overlays */}
        {cameraStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
            <div className="relative">
              <Loader2 size={48} className="animate-spin text-brand-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Cpu size={20} className="text-brand-primary/50" />
              </div>
            </div>
            <p className="text-brand-primary/60 text-[9px] font-black uppercase tracking-[0.4em] animate-pulse">Iniciando Sensor...</p>
          </div>
        )}

        {cameraStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-10 gap-6 bg-slate-950 z-40">
            <div className="bg-red-500/20 p-6 rounded-full w-24 h-24 flex items-center justify-center glow-red border border-red-500/40">
              <Camera size={40} className="text-red-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider font-mono-display text-white">ERROR DE SENSOR</h3>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xs">Acceso denegado. Se requiere cámara para continuar con el protocolo de seguridad.</p>
            </div>
            <button onClick={() => window.location.reload()} className="btn-brand w-full max-w-xs text-xs">REINICIAR SISTEMA</button>
          </div>
        )}

        {/* Scanning Reticle */}
        {cameraStatus === 'ready' && (
          <div className={`absolute inset-0 pointer-events-none flex items-center justify-center p-12 transition-all duration-300 ${isCapturing ? 'scale-90 opacity-0' : 'opacity-100'}`}>
            <div className="w-full aspect-square relative border border-white/5 rounded-[4rem]">
              {/* Scan Bar */}
              <div className="absolute inset-x-8 top-1/2 h-[1px] bg-brand-primary/40 shadow-[0_0_15px_rgba(247,147,26,0.8)] animate-scan" />
              
              {/* Corner Indicators */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-brand-primary rounded-tl-2xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-brand-primary rounded-tr-2xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-brand-primary rounded-bl-2xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-brand-primary rounded-br-2xl" />
              
              {/* Center Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <div className="w-10 h-[1px] bg-white" />
                <div className="h-10 w-[1px] bg-white absolute" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="h-44 bg-black flex flex-col items-center justify-center px-8 z-30 pt-4">
        {cameraStatus === 'ready' && (
          <>
            <button
              onClick={capture}
              disabled={isCapturing}
              className="relative group transition-all active:scale-75 disabled:opacity-20"
            >
              {/* Outer Ring */}
              <div className="w-24 h-24 rounded-full border-4 border-white/20 flex items-center justify-center relative">
                {/* Visual Feedback on Capture */}
                <div className={`absolute inset-[-8px] rounded-full border-2 border-brand-primary transition-all duration-300 ${isCapturing ? 'scale-150 opacity-0' : 'scale-100 opacity-60'}`} />
                {/* Inner Button */}
                <div className="w-18 h-18 bg-white rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  <div className="w-15 h-15 rounded-full border-2 border-black/10" />
                </div>
              </div>
            </button>
            <div className="mt-4 flex flex-col items-center">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 mb-1">
                {isCapturing ? 'PROCESANDO...' : 'EJECUTAR CAPTURA'}
              </span>
              <div className="flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-brand-primary/40 rounded-full animate-blink" style={{ animationDelay: `${i*0.2}s` }} />)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
