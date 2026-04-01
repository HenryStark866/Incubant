import React, { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2, X, FileText, Thermometer, Droplets } from 'lucide-react';
import { apiFetch, getApiUrl } from '../lib/api';
import { useMachineStore } from '../store/useMachineStore';

interface ReportResult {
  temperature: string;
  humidity: string;
  processStatus: string;
  imageUrl: string;
  pdfUrl: string;
  savedToDb: boolean;
}

interface ReportUploaderProps {
  machineId: string;
  machineName: string;
  reportData?: Record<string, any>;
  onSuccess?: (result: ReportResult) => void;
  onClose?: () => void;
}

type UploadState = 'idle' | 'pending' | 'analyzing' | 'uploading' | 'success' | 'error';

const STATE_MESSAGES: Record<UploadState, string> = {
  idle: 'Selecciona o captura una foto del panel de la máquina',
  pending: 'Imagen lista. Presiona "Enviar Reporte" para procesar.',
  analyzing: 'Analizando imagen con inteligencia artificial...',
  uploading: 'Subiendo evidencia y generando reporte PDF...',
  success: '¡Reporte registrado exitosamente!',
  error: 'Ocurrió un error al procesar el reporte.',
};

export default function ReportUploader({ machineId, machineName, reportData, onSuccess, onClose }: ReportUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const currentUser = useMachineStore(state => state.currentUser);

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido.');
      setUploadState('error');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState('pending');
    setErrorMsg('');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setUploadState('analyzing');

    try {
      const formData = new FormData();
      formData.append('evidence', selectedFile);
      formData.append('machineId', machineId);
      if (reportData) {
        formData.append('reportData', JSON.stringify(reportData));
      }

      setUploadState('uploading');

      const response = await apiFetch(getApiUrl('/api/reports'), {
        method: 'POST',
        body: formData,
        // No establecer Content-Type — el navegador lo incluye automáticamente con el boundary
        headers: {},
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido del servidor');
      }

      setResult(data.report);
      setUploadState('success');
      onSuccess?.(data.report);

    } catch (error) {
      console.error('[ReportUploader] Error:', error);
      setErrorMsg(error instanceof Error ? error.message : 'Error de conexión al servidor.');
      setUploadState('error');
    }
  };

  const handleReset = () => {
    setUploadState('idle');
    setPreviewUrl(null);
    setSelectedFile(null);
    setResult(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const isProcessing = uploadState === 'analyzing' || uploadState === 'uploading';

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Reporte Horario</h2>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">{machineName}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Estado actual */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold ${
            uploadState === 'success' ? 'bg-green-50 text-green-700' :
            uploadState === 'error' ? 'bg-red-50 text-red-700' :
            isProcessing ? 'bg-blue-50 text-blue-700' :
            'bg-gray-50 text-gray-600'
          }`}>
            {isProcessing && <Loader2 size={16} className="animate-spin shrink-0" />}
            {uploadState === 'success' && <CheckCircle2 size={16} className="shrink-0" />}
            {uploadState === 'error' && <AlertTriangle size={16} className="shrink-0" />}
            <span>{uploadState === 'error' ? errorMsg : STATE_MESSAGES[uploadState]}</span>
          </div>

          {/* Área de imagen */}
          {uploadState !== 'success' && (
            <div
              className={`relative rounded-2xl overflow-hidden border-2 border-dashed transition-all ${
                previewUrl ? 'border-brand-primary' : 'border-gray-200 hover:border-gray-300'
              } bg-gray-50`}
              style={{ minHeight: 200 }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Evidencia"
                  className="w-full h-52 object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                  <Camera size={40} strokeWidth={1.5} />
                  <p className="text-sm font-medium">Sin imagen seleccionada</p>
                </div>
              )}
            </div>
          )}

          {/* Resultado de éxito */}
          {uploadState === 'success' && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-2xl p-4 flex flex-col items-center">
                  <Thermometer size={20} className="text-orange-500 mb-1" />
                  <span className="text-xl font-black text-gray-900">{result.temperature}</span>
                  <span className="text-xs text-gray-500 font-semibold">Temperatura</span>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 flex flex-col items-center">
                  <Droplets size={20} className="text-blue-500 mb-1" />
                  <span className="text-xl font-black text-gray-900">{result.humidity}</span>
                  <span className="text-xs text-gray-500 font-semibold">Humedad</span>
                </div>
              </div>
              <div className={`rounded-2xl px-4 py-3 text-center font-bold text-sm ${
                result.processStatus === 'ALARMA' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                Estado: {result.processStatus}
              </div>
              {result.pdfUrl && (
                <a
                  href={result.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-gray-700 font-bold text-sm transition-colors"
                >
                  <FileText size={16} />
                  Ver PDF del Reporte
                </a>
              )}
            </div>
          )}

          {/* Botones de selección / acción */}
          {uploadState !== 'success' && !isProcessing && (
            <div className="grid grid-cols-2 gap-3">
              {/* Cámara (en móvil abre directamente la cámara) */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-gray-200 hover:border-brand-primary hover:bg-orange-50 text-gray-600 hover:text-brand-primary transition-all font-bold text-xs uppercase tracking-wide"
              >
                <Camera size={22} />
                Tomar Foto
              </button>

              {/* Subir desde galería */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-gray-200 hover:border-brand-primary hover:bg-orange-50 text-gray-600 hover:text-brand-primary transition-all font-bold text-xs uppercase tracking-wide"
              >
                <Upload size={22} />
                Galería
              </button>
            </div>
          )}

          {/* Inputs ocultos */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Botón principal de envío */}
          {uploadState === 'pending' && !isProcessing && (
            <button
              onClick={handleSubmit}
              className="w-full py-4 bg-brand-primary text-white font-black rounded-2xl shadow-lg shadow-brand-primary/20 hover:bg-[#E6951F] active:scale-95 transition-all uppercase tracking-wide text-sm flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Enviar Reporte
            </button>
          )}

          {isProcessing && (
            <div className="w-full py-4 bg-brand-primary/20 text-brand-primary font-black rounded-2xl text-sm flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Procesando...
            </div>
          )}

          {(uploadState === 'success' || uploadState === 'error') && (
            <button
              onClick={uploadState === 'success' ? onClose : handleReset}
              className="w-full py-4 border-2 border-gray-200 text-gray-700 font-black rounded-2xl hover:bg-gray-50 active:scale-95 transition-all uppercase tracking-wide text-sm"
            >
              {uploadState === 'success' ? 'Cerrar' : 'Intentar de Nuevo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
