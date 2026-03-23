import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useMachineStore } from '../store/useMachineStore';
import { Camera, X, RefreshCcw, ArrowRight, AlertCircle } from 'lucide-react';

export default function CameraScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const setActiveMachine = useMachineStore(state => state.setActiveMachine);
  const machines = useMachineStore(state => state.machines);
  
  const machine = machines.find(m => m.id === activeMachineId);
  
  const webcamRef = useRef<Webcam>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);

  const capture = useCallback(() => {
    const image = webcamRef.current?.getScreenshot();
    if (image) {
      setImageSrc(image);
    }
  }, [webcamRef]);

  const retake = () => {
    setImageSrc(null);
  };

  const continueToForm = () => {
    setCapturedPhoto(imageSrc);
  };

  if (!machine) return null;

  // PREVIEW STATE
  if (imageSrc) {
    return (
      <div className="flex flex-col h-full bg-black text-white pt-6">
        <div className="flex items-center justify-between p-4 z-10">
          <button 
            onClick={() => setActiveMachine(null)}
            className="p-2 bg-gray-800 rounded-full text-white"
          >
            <X size={24} />
          </button>
          <h2 className="font-bold">Previsualización</h2>
          <div className="w-10"></div> {/* Spacer */}
        </div>

        <div className="flex-1 relative flex items-center justify-center p-4">
          <img 
            src={imageSrc} 
            alt="Captura de máquina" 
            className="w-full h-auto max-h-full object-contain rounded-xl border-2 border-gray-700"
          />
        </div>

        <div className="p-6 bg-gray-900 rounded-t-3xl flex flex-col gap-4">
          <button 
            onClick={retake}
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-gray-800 text-white active:bg-gray-700 transition-colors"
          >
            <RefreshCcw size={20} />
            Retomar Foto
          </button>
          
          <button 
            onClick={continueToForm}
            className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 bg-blue-600 text-white active:bg-blue-700 transition-colors"
          >
            Continuar al Formulario
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  // CAMERA STATE
  return (
    <div className="flex flex-col h-full bg-black text-white pt-6 relative">
      {/* Header overlay */}
      <div className="absolute top-6 inset-x-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={() => setActiveMachine(null)}
          className="p-2 bg-gray-800/80 backdrop-blur-sm rounded-full text-white"
        >
          <X size={24} />
        </button>
        <div className="bg-blue-600 px-4 py-1.5 rounded-full font-bold text-sm shadow-lg">
          {machine.type === 'incubadora' ? 'Incubadora' : 'Nacedora'} {machine.number}
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      {/* Camera Viewfinder */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
        {permissionDenied ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-gray-400">
            <AlertCircle size={48} className="mb-4 text-red-500" />
            <p className="font-bold text-white mb-2">Permiso de cámara denegado</p>
            <p className="text-sm">La aplicación requiere acceso a la cámara para tomar fotos en vivo de las máquinas.</p>
          </div>
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'environment' }}
            onUserMediaError={() => setPermissionDenied(true)}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Viewfinder guides */}
        <div className="absolute inset-0 pointer-events-none border-[40px] border-black/30">
          <div className="w-full h-full border-2 border-white/30 rounded-lg"></div>
        </div>
      </div>

      {/* Controls */}
      <div className="h-32 bg-black flex items-center justify-center pb-6">
        <button 
          onClick={capture}
          disabled={permissionDenied}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          <div className="w-16 h-16 bg-white rounded-full"></div>
        </button>
      </div>
    </div>
  );
}
