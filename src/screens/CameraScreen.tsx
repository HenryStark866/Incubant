import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, X, FlipHorizontal } from 'lucide-react';

export default function CameraScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);
  const machines = useMachineStore(state => state.machines);
  const autoReportMachine = useMachineStore(state => state.autoReportMachine);
  
  const machine = machines.find(m => m.id === activeMachineId);
  const webcamRef = useRef<Webcam>(null);
  
  // States
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    // Intentar pedir permiso explícitamente si es soportado
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setPermissionState('granted'))
        .catch(() => setPermissionState('denied'));
    }
  }, []);

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const captureAndProcess = () => {
    // Intentar captura, o usar mock si se invoca desde el botón de demo y no hay cámara
    let image = webcamRef.current?.getScreenshot();
    
    if (!image) {
      // Imagen placeholder cuando no hay cámara disponible
      image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    }

    if (!image || !activeMachineId) return;

    // Feedback táctil
    navigator.vibrate?.([50]);

    // Guardar foto en el store y navegar al FormScreen
    setCapturedPhoto(image);
  };

  if (!machine) return null;


  return (
    <div className="flex flex-col h-full bg-black text-white relative overscroll-none overflow-hidden">
      {/* Viewfinder Header */}
      <div className="absolute top-10 inset-x-0 flex items-center justify-between px-6 z-20">
        <button 
          onClick={() => setActiveMachine(null)}
          className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 active:scale-95 transition-all"
        >
          <X size={24} />
        </button>
        <div className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
              Escaneo IA Activo
            </div>
            <div className="font-black text-lg">
              {machine.type === 'incubadora' ? 'INC' : 'NAC'}-{machine.number.toString().padStart(2, '0')}
            </div>
        </div>
        <button 
          onClick={flipCamera}
          className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white border border-white/10 active:scale-95 transition-all"
        >
          <FlipHorizontal size={24} />
        </button>
      </div>

      {/* Main Camera Body */}
      <div className="flex-1 relative bg-slate-900 flex items-center justify-center overflow-hidden">
        {permissionState === 'denied' ? (
          <div className="p-10 text-center space-y-6">
            <div className="bg-red-500/20 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
              <Camera size={48} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight">Cámara Bloqueada</h3>
            <div className="space-y-4">
              <p className="text-slate-400 text-sm leading-relaxed">Debes habilitar el permiso de cámara en la configuración de tu navegador o celular.</p>
              
              {!window.isSecureContext && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-xs text-orange-400 font-bold">
                  ⚠️ NOTA: Los celulares bloquean la cámara en sitios "HTTP". Asegúrate de usar una conexión "HTTPS" segura o localhost.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="px-8 py-4 bg-white text-black font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-all w-full"
              >
                Reintentar Permisos
              </button>
              <button 
                onClick={captureAndProcess}
                className="px-8 py-4 bg-brand-primary text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-all w-full"
              >
                Continuar sin Foto
              </button>
            </div>
            <p className="text-[9px] text-slate-500 italic max-w-xs mx-auto">Podrás llenar el formulario manualmente sin necesidad de cámara.</p>
          </div>
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ 
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }}
            onUserMediaError={(err) => {
              console.error('Camera error:', err);
              setPermissionState('denied');
            }}
            onUserMedia={() => setPermissionState('granted')}
            className="w-full h-full object-cover"
            playsInline
          />
        )}
        
        {/* Futuristic Overlay Guide */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
           <div className="w-full aspect-square border-[1.5px] border-white/20 rounded-[3rem] relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-primary rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-primary rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-primary rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-primary rounded-br-2xl"></div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-brand-primary/10 animate-scan"></div>
              </div>
           </div>
        </div>
      </div>

      {/* Capture Button Area */}
      <div className="h-44 bg-black flex flex-col items-center justify-center px-8 relative">
        {/* Hidden Demo button for video recording without physical camera */}
        <button 
          onClick={captureAndProcess}
          className="absolute top-2 right-4 text-[7px] text-white/20 font-black uppercase tracking-widest border border-white/5 px-2 py-1 rounded"
        >
          Demostración IA
        </button>
        
        <button 
          onClick={captureAndProcess}
          disabled={permissionState !== 'granted'}
          className="relative group disabled:opacity-30 transition-all active:scale-90"
        >
          <div className="w-24 h-24 rounded-full border-[3px] border-white flex items-center justify-center">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                <Camera size={32} className="text-black" />
             </div>
          </div>
          <div className="absolute -top-12 inset-x-0 text-center opacity-40 text-[9px] font-black uppercase tracking-[0.3em]">Centrar Pantalla</div>
        </button>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-100px); opacity: 0; }
          50% { transform: translateY(100px); opacity: 1; }
        }
        .animate-scan {
          animation: scan 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}

