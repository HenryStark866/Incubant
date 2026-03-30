import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, X, FlipHorizontal, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Estado de la cámara:
 * - 'loading'  : Esperando que el navegador otorgue acceso (estado inicial)
 * - 'ready'    : Cámara activa y lista para capturar
 * - 'error'    : Permiso denegado o cámara no disponible
 */
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

  // Llamado por el componente Webcam cuando la cámara se activa correctamente
  const handleCameraReady = () => {
    setCameraStatus('ready');
  };

  // Llamado por el componente Webcam cuando hay un error de permisos/hardware
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

    // Pequeño delay para mostrar el flash visual antes de navegar
    setTimeout(() => {
      setCapturedPhoto(image);
    }, 120);
  };

  if (!machine) return null;

  const machineLabel = `${machine.type === 'incubadora' ? 'INC' : 'NAC'}-${machine.number.toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full bg-black text-white relative overscroll-none overflow-hidden">

      {/* ── Header ── */}
      <div className="absolute top-10 inset-x-0 flex items-center justify-between px-6 z-20">
        <button
          onClick={() => setActiveMachine(null)}
          className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 active:scale-95 transition-all"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="bg-white/10 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em]">
            📷 Foto Obligatoria
          </div>
          <div className="font-black text-lg">{machineLabel}</div>
        </div>

        <button
          onClick={flipCamera}
          disabled={cameraStatus === 'error'}
          className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 active:scale-95 transition-all disabled:opacity-30"
        >
          <FlipHorizontal size={24} />
        </button>
      </div>

      {/* ── Cuerpo de la cámara ── */}
      <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">

        {/* 
          El componente Webcam SIEMPRE se monta para que gestione los permisos.
          Lo ocultamos visualmente mientras carga o hay error, pero NO lo desmontamos,
          ya que desmontarlo causa que el estado de la cámara se reinicie.
        */}
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }}
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          playsInline
          className="w-full h-full object-cover"
          style={{
            // Visible solo cuando está lista; evita el flash de video negra
            opacity: cameraStatus === 'ready' ? 1 : 0,
            position: cameraStatus === 'ready' ? 'relative' : 'absolute',
            pointerEvents: 'none',
          }}
        />

        {/* Estado: CARGANDO */}
        {cameraStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-slate-950">
            <Loader2 size={52} className="animate-spin text-white/40" />
            <p className="text-white/40 text-xs font-black uppercase tracking-[0.25em]">
              Iniciando Cámara...
            </p>
          </div>
        )}

        {/* Estado: ERROR */}
        {cameraStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-10 gap-6 bg-slate-950">
            <div className="bg-red-500/15 p-6 rounded-full w-24 h-24 flex items-center justify-center">
              <Camera size={48} className="text-red-400" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                Cámara No Disponible
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                La foto es obligatoria para registrar el reporte. Habilita el permiso de cámara.
              </p>
            </div>

            {!window.isSecureContext && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex gap-3 items-start w-full">
                <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-orange-400 font-bold leading-snug">
                  Los celulares bloquean la cámara en sitios HTTP. Usa la URL
                  con <span className="underline">HTTPS</span>.
                </p>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white text-black font-black rounded-2xl uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Reintentar Permisos
            </button>
          </div>
        )}

        {/* Overlay de encuadre — solo visible cuando la cámara está lista */}
        {cameraStatus === 'ready' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div
              className={`w-full aspect-square border-[1.5px] border-white/20 rounded-[3rem] relative transition-all duration-200 ${
                isCapturing ? 'scale-95 border-white/60' : ''
              }`}
            >
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary rounded-br-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-[1px] bg-brand-primary/15 animate-scan" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Área del botón de captura ── */}
      <div className="h-44 bg-black flex flex-col items-center justify-center px-8 gap-3">

        {cameraStatus === 'loading' && (
          <p className="text-white/25 text-[10px] font-black uppercase tracking-[0.3em]">
            Esperando cámara...
          </p>
        )}

        {cameraStatus === 'ready' && (
          <>
            <button
              onClick={capture}
              disabled={isCapturing}
              className="relative group disabled:opacity-50 transition-all active:scale-90"
            >
              <div
                className={`w-24 h-24 rounded-full border-[3px] border-white flex items-center justify-center transition-transform duration-150 ${
                  isCapturing ? 'scale-90' : ''
                }`}
              >
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                  <Camera size={32} className="text-black" />
                </div>
              </div>
            </button>
            <p className="text-white/30 text-[9px] font-black uppercase tracking-[0.3em]">
              {isCapturing ? 'Capturando...' : 'Tomar Foto · Obligatorio'}
            </p>
          </>
        )}

        {/* Sin botón de "saltar" — la foto es siempre obligatoria */}
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-80px); opacity: 0; }
          50%       { transform: translateY(80px);  opacity: 1; }
        }
        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
