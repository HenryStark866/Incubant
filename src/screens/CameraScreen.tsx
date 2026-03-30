import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, X, RefreshCcw, CheckCircle2, AlertCircle, Loader2, FlipHorizontal, Zap } from 'lucide-react';
import { apiFetch, getApiUrl } from '../lib/api';

export default function CameraScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const machines = useMachineStore(state => state.machines);
  const autoReportMachine = useMachineStore(state => state.autoReportMachine);
  
  const machine = machines.find(m => m.id === activeMachineId);
  const webcamRef = useRef<Webcam>(null);
  
  // States
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
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

  const captureAndProcess = async () => {
    // Intentar captura, o usar mock si se invoca desde el botón de demo y no hay cámara
    let image = webcamRef.current?.getScreenshot();
    
    if (!image) {
      // Imagen Mock 1x1 base64 (Un píxel negro transparente)
      image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    }

    if (!image || !activeMachineId) return;

    setImageSrc(image);
    setIsProcessing(true);

    try {
      // 1. Convertir base64 a Blob
      const bitString = atob(image.split(',')[1]);
      const mime = image.split(',')[0].split(':')[1].split(';')[0];
      const byteNumbers = new Array(bitString.length);
      for (let i = 0; i < bitString.length; i++) {
        byteNumbers[i] = bitString.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });

      // 2. Preparar FormData
      const formData = new FormData();
      formData.append('file', blob, 'capture.jpg');
      formData.append('machineId', activeMachineId);

      // 3. Enviar al API
      const response = await apiFetch(getApiUrl('/api/reports'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error en el servidor');

      const result = await response.json();
      setProcessingResult(result);
      
      // Feedback táctil
      navigator.vibrate?.([100, 50, 100]);

      // 4. Auto-Guardar localmente y cerrar
      setTimeout(() => {
        autoReportMachine(activeMachineId, result.report.imageUrl);
      }, 2500);

    } catch (err) {
      console.error('Fallo autónomo:', err);
      setIsProcessing(false);
      setImageSrc(null);
      alert('⚠️ No se pudo procesar la foto. Verifica tu conexión o toma la foto más cerca.');
    }
  };

  if (!machine) return null;

  // ESTADO: PROCESANDO / ÉXITO
  if (isProcessing) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-white items-center justify-center p-8 text-center">
        {!processingResult ? (
          <div className="space-y-6 animate-pulse">
            <div className="relative">
              <div className="absolute inset-x-0 -top-4 -bottom-4 bg-blue-500/10 blur-3xl rounded-full"></div>
              <Loader2 size={80} className="text-blue-400 animate-spin mx-auto relative z-10" />
              <Zap size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Analizando con IA</h2>
              <p className="text-slate-400 text-sm font-medium">Extrayendo parámetros críticos de la imagen...</p>
            </div>
            <img src={imageSrc!} className="w-48 h-48 object-cover rounded-3xl mx-auto border-2 border-white/10 opacity-40 grayscale" />
          </div>
        ) : (
          <div className="space-y-8 animate-in zoom-in duration-500">
            <div className="bg-green-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-500/40">
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Reporte Generado</h2>
              <p className="text-green-400 font-black tracking-[0.2em] uppercase text-xs">Guardado en Drive y SQL</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4 w-full">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold">Máquina</span>
                  <span className="font-black">{machine.type === 'incubadora' ? 'INC' : 'NAC'}-{machine.number.toString().padStart(2, '0')}</span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold">Estado detectado</span>
                  <span className={`px-3 py-1 rounded-full font-black text-[10px] ${processingResult.report.isAlarm ? 'bg-red-500' : 'bg-green-500'}`}>
                    {processingResult.report.isAlarm ? 'ALARMA 1.5°F' : 'OPERACIÓN NORMAL'}
                  </span>
               </div>
            </div>
            <p className="text-xs text-slate-500 animate-pulse">Sincronizando con el panel de supervisor...</p>
          </div>
        )}
      </div>
    );
  }

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
                className="px-8 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-lg active:scale-95 transition-all w-full"
              >
                Simular Captura IA
              </button>
            </div>
            <p className="text-[9px] text-slate-500 italic max-w-xs mx-auto">TIP: Usa este botón para mostrar el funcionamiento del reporte automático si la cámara está deshabilitada.</p>
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

