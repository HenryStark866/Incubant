import React, { useState, useCallback, useEffect } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, AlertCircle, Thermometer, Droplets, Calendar, RotateCw, Wind, Bell, MessageSquare, Activity, CheckCircle2, Egg } from 'lucide-react';

// Focus Fix: Move InputField component OUTSIDE the main render function
const InputField = React.memo(({ 
  label, value, onChange, placeholder, unit, icon: Icon, error 
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string, 
  unit: string,
  icon: any,
  error?: boolean
}) => (
  <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${
    error ? 'border-red-400 bg-red-50/10' : 'border-gray-100'
  }`}>
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-xl ${error ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-brand-dark'}`}>
        <Icon size={18} />
      </div>
      <label className="text-[11px] font-black text-brand-dark uppercase tracking-widest opacity-80">
        {label}
      </label>
    </div>
    
    <div className="relative">
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[2rem] font-black text-brand-dark focus:outline-none placeholder:text-gray-200 transition-all leading-none py-1"
      />
      <div className="absolute right-0 bottom-2 flex items-center gap-2 pointer-events-none">
         <span className={`text-[12px] font-black uppercase tracking-[0.2em] ${error ? 'text-red-400' : 'text-gray-300'}`}>
          {unit}
        </span>
      </div>
    </div>
  </div>
));

// Specialized Select for Alarm
const AlarmToggle = ({ value, onChange, error }: { value: 'Si' | 'No' | '', onChange: (v: 'Si' | 'No') => void, error?: boolean }) => (
  <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between ${
    error ? 'border-red-400 bg-red-50/10' : 'border-gray-100'
  }`}>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gray-50 text-brand-dark">
        <Bell size={18} />
      </div>
      <label className="text-[11px] font-black text-brand-dark uppercase tracking-widest opacity-80">Alarma Activa</label>
    </div>
    <div className="flex gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
      <button 
        onClick={() => onChange('Si')} 
        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'Si' ? 'bg-red-500 text-white shadow-md shadow-red-500/20' : 'text-gray-400 hover:text-gray-600'}`}
      >
        SÍ
      </button>
      <button 
        onClick={() => onChange('No')} 
        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'No' ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 'text-gray-400 hover:text-gray-600'}`}
      >
        NO
      </button>
    </div>
  </div>
);

export default function FormScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const machines = useMachineStore(state => state.machines);
  const saveMachineData = useMachineStore(state => state.saveMachineData);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);

  const machine = machines.find(m => m.id === activeMachineId);
  const isIncubadora = machine?.type === 'incubadora';

  const [formData, setFormData] = useState<MachineData>({
    diaIncubacion: '',
    tempOvoscan: '',
    tempAire: '',
    volteoNumero: '',
    volteoPosicion: '',
    alarma: 'No',
    temperatura: '',
    humedadRelativa: '',
    co2: '',
    observaciones: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MachineData, boolean>>>({});
  const [showToast, setShowToast] = useState(false);

  const handleInputChange = useCallback((field: keyof MachineData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  }, [errors]);

  const handleSave = () => {
    const newErrors: Partial<Record<keyof MachineData, boolean>> = {};
    let hasErrors = false;

    // Campos comunes requeridos
    if (!formData.diaIncubacion) { newErrors.diaIncubacion = true; hasErrors = true; }
    if (!formData.humedadRelativa) { newErrors.humedadRelativa = true; hasErrors = true; }
    if (!formData.co2) { newErrors.co2 = true; hasErrors = true; }

    if (isIncubadora) {
      if (!formData.tempOvoscan) { newErrors.tempOvoscan = true; hasErrors = true; }
      if (!formData.tempAire) { newErrors.tempAire = true; hasErrors = true; }
      if (!formData.volteoNumero) { newErrors.volteoNumero = true; hasErrors = true; }
      if (!formData.volteoPosicion) { newErrors.volteoPosicion = true; hasErrors = true; }
    } else {
      if (!formData.temperatura) { newErrors.temperatura = true; hasErrors = true; }
    }

    if (hasErrors) {
      setErrors(newErrors);
      navigator.vibrate?.([50, 50, 50]);
      return;
    }

    setShowToast(true);
    navigator.vibrate?.(100);
    
    // Defer save to allow toast to render
    setTimeout(() => {
      saveMachineData(machine!.id, formData, capturedPhoto!);
    }, 1500);
  };

  if (!machine || !capturedPhoto) return null;

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] relative font-sans">
      
      {/* Production-Ready Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCapturedPhoto(null)}
            className="p-2.5 bg-gray-50 text-brand-dark rounded-xl active:scale-95 transition-all border border-gray-100 hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
             <div className="flex items-center gap-1.5 mb-2">
               <div className="bg-brand-primary p-1 rounded text-white shadow-sm">
                 <Egg size={14} />
               </div>
               <span className="text-sm font-black text-brand-dark tracking-tight leading-none pointer-events-none">INCUBANT</span>
             </div>
             <p className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.2em] leading-none">
              Control: {isIncubadora ? 'Incubadora' : 'Nacedora'} {machine.number.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-48 space-y-4">
        
        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-24 inset-x-5 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-green-500 text-white p-4 rounded-2xl flex items-center gap-4 shadow-xl shadow-green-500/30 border border-green-400">
              <div className="bg-white/20 p-2 rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-black uppercase tracking-widest">Registro Guardado</p>
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {Object.keys(errors).length > 0 && !showToast && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-widest leading-none">Faltan datos obligatorios</p>
          </div>
        )}

        {/* UNIFIED SINGLE COLUMN LAYOUT */}
        <div className="space-y-4">
          
          <InputField 
            label="Día de Incubación" 
            value={formData.diaIncubacion} 
            onChange={(v) => handleInputChange('diaIncubacion', v)}
            placeholder="" 
            unit="DÍAS" 
            icon={Calendar}
            error={errors.diaIncubacion}
          />

          {isIncubadora ? (
            <>
              <InputField 
                label="Temperatura Ovoscan" 
                value={formData.tempOvoscan || ''} 
                onChange={(v) => handleInputChange('tempOvoscan', v)}
                placeholder="" 
                unit="°C" 
                icon={Thermometer}
                error={errors.tempOvoscan}
              />
              <InputField 
                label="Temperatura Aire" 
                value={formData.tempAire || ''} 
                onChange={(v) => handleInputChange('tempAire', v)}
                placeholder="" 
                unit="°C" 
                icon={Wind}
                error={errors.tempAire}
              />

              <InputField 
                label="Humedad Relativa" 
                value={formData.humedadRelativa} 
                onChange={(v) => handleInputChange('humedadRelativa', v)}
                placeholder="" 
                unit="%" 
                icon={Droplets}
                error={errors.humedadRelativa}
              />

              <InputField 
                label="Nivel CO2" 
                value={formData.co2} 
                onChange={(v) => handleInputChange('co2', v)}
                placeholder="" 
                unit="%" 
                icon={Activity}
                error={errors.co2}
              />

              <InputField 
                label="Número de Volteos" 
                value={formData.volteoNumero || ''} 
                onChange={(v) => handleInputChange('volteoNumero', v)}
                placeholder="" 
                unit="CNT" 
                icon={RotateCw}
                error={errors.volteoNumero}
              />
              
              <InputField 
                label="Posición de Volteo" 
                value={formData.volteoPosicion || ''} 
                onChange={(v) => handleInputChange('volteoPosicion', v)}
                placeholder="" 
                unit="° GRD" 
                icon={RotateCw}
                error={errors.volteoPosicion}
              />

              <AlarmToggle 
                value={formData.alarma || ''} 
                onChange={(v) => handleInputChange('alarma', v)}
                error={errors.alarma}
              />
            </>
          ) : (
            <>
              {/* NACEDORA SPECIFIC FIELDS */}
              <InputField 
                label="Temperatura" 
                value={formData.temperatura || ''} 
                onChange={(v) => handleInputChange('temperatura', v)}
                placeholder="" 
                unit="°C" 
                icon={Thermometer}
                error={errors.temperatura}
              />
              <InputField 
                label="Humedad Relativa" 
                value={formData.humedadRelativa} 
                onChange={(v) => handleInputChange('humedadRelativa', v)}
                placeholder="" 
                unit="%" 
                icon={Droplets}
                error={errors.humedadRelativa}
              />
              <InputField 
                label="Nivel CO2" 
                value={formData.co2} 
                onChange={(v) => handleInputChange('co2', v)}
                placeholder="" 
                unit="%" 
                icon={Activity}
                error={errors.co2}
              />
            </>
          )}

          <div className="bg-white rounded-3xl p-5 border-2 border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
             <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-gray-50 text-brand-dark">
                  <MessageSquare size={18} />
                </div>
                <label className="text-[11px] font-black text-brand-dark uppercase tracking-widest opacity-80">Observaciones</label>
             </div>
             <textarea
                value={formData.observaciones}
                onChange={(e) => handleInputChange('observaciones', e.target.value)}
                placeholder="Describe cualquier anomalía..."
                className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-5 py-4 text-sm text-brand-dark font-medium focus:outline-none focus:border-brand-primary focus:bg-white transition-all min-h-[100px] resize-none"
             />
          </div>
        </div>
      </div>

      {/* Corporate Production Button */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#f9fafb] via-[#f9fafb] to-transparent z-40">
        <button 
          onClick={handleSave}
          disabled={showToast}
          className={`w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all uppercase tracking-widest ${
            showToast 
              ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
              : 'bg-[#F5A623] text-white active:scale-95 shadow-xl shadow-[#F5A623]/30'
          }`}
        >
          {showToast ? (
            <>
              <CheckCircle2 size={24} /> GRABANDO...
            </>
          ) : (
            <>
              <Save size={24} /> GUARDAR
            </>
          )}
        </button>
      </div>
    </div>
  );
}
