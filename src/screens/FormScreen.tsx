import React, { useState, useCallback } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, AlertCircle, Thermometer, Droplets, Calendar, RotateCw, Wind, Bell, MessageSquare } from 'lucide-react';

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
  <div className={`bg-white rounded-[1.8rem] p-6 border-2 transition-all shadow-sm ${
    error ? 'border-red-500 bg-red-50/50' : 'border-gray-50 bg-white'
  }`}>
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2.5 rounded-xl ${error ? 'bg-red-100 text-red-600' : 'bg-brand-primary/10 text-brand-primary'}`}>
        <Icon size={18} />
      </div>
      <label className="text-xs font-black text-brand-dark uppercase tracking-widest">
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
        className="w-full bg-transparent text-2xl font-black text-brand-dark focus:outline-none placeholder:text-gray-200 transition-all"
      />
      <div className="absolute right-0 bottom-1 flex items-center gap-2 pointer-events-none">
         <span className={`text-[10px] font-black uppercase tracking-widest ${error ? 'text-red-400' : 'text-brand-gray opacity-30'}`}>
          {unit}
        </span>
      </div>
    </div>
  </div>
));

// Specialized Select for Alarm
const AlarmToggle = ({ value, onChange }: { value: 'Si' | 'No' | '', onChange: (v: 'Si' | 'No') => void }) => (
  <div className="bg-white rounded-[1.8rem] p-6 border-2 border-gray-50 shadow-sm flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
        <Bell size={18} />
      </div>
      <label className="text-xs font-black text-brand-dark uppercase tracking-widest">Alarma Activa</label>
    </div>
    <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl">
      <button 
        onClick={() => onChange('Si')} 
        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${value === 'Si' ? 'bg-red-500 text-white shadow-md' : 'text-brand-gray'}`}
      >
        SÍ
      </button>
      <button 
        onClick={() => onChange('No')} 
        className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${value === 'No' ? 'bg-green-500 text-white shadow-md' : 'text-brand-gray'}`}
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
      navigator.vibrate?.(100);
      return;
    }

    saveMachineData(machine!.id, formData, capturedPhoto!);
  };

  if (!machine || !capturedPhoto) return null;

  return (
    <div className="flex flex-col h-full bg-[#FAFAFB] relative font-sans">
      
      {/* Production-Ready Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCapturedPhoto(null)}
            className="p-2.5 bg-gray-50 text-brand-dark rounded-xl active:scale-95 transition-all border border-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
             <img src="/logo.png" alt="Incubant" className="h-6 w-auto mb-0.5" />
             <p className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em] leading-none">
              Registro: {isIncubadora ? 'Incubadora' : 'Nacedora'} {machine.number.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-48 space-y-5">
        
        {/* Visual Reference Card */}
        <div className="bg-white p-3 rounded-[2rem] border border-gray-50 shadow-sm flex items-center gap-4">
           <div className="w-28 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-inner shrink-0 bg-brand-dark">
             <img src={capturedPhoto} alt="Captura" className="w-full h-full object-cover" />
           </div>
           <div className="pr-4">
             <h4 className="text-[10px] font-black text-brand-dark uppercase tracking-widest opacity-60">Control Automático</h4>
             <p className="text-xs text-brand-gray font-bold leading-tight mt-1">Ingresa los parámetros según el formato oficial de planta.</p>
           </div>
        </div>

        {/* Validation Error Banner */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-500 text-white p-5 rounded-3xl flex items-center gap-4 shadow-xl shadow-red-500/10">
            <AlertCircle size={24} className="shrink-0" />
            <p className="text-xs font-black uppercase tracking-widest leading-none">Datos Incompletos</p>
          </div>
        )}

        {/* Field Cards */}
        <div className="space-y-4">
          
          <InputField 
            label="Día Actual" 
            value={formData.diaIncubacion} 
            onChange={(v) => handleInputChange('diaIncubacion', v)}
            placeholder="0" 
            unit="DÍA" 
            icon={Calendar}
            error={errors.diaIncubacion}
          />

          {isIncubadora ? (
            <>
               <div className="grid grid-cols-2 gap-4">
                 <InputField 
                   label="Temp Ovoscan" 
                   value={formData.tempOvoscan || ''} 
                   onChange={(v) => handleInputChange('tempOvoscan', v)}
                   placeholder="0.0" 
                   unit="°C" 
                   icon={Thermometer}
                   error={errors.tempOvoscan}
                 />
                 <InputField 
                   label="Temp Aire" 
                   value={formData.tempAire || ''} 
                   onChange={(v) => handleInputChange('tempAire', v)}
                   placeholder="0.0" 
                   unit="°C" 
                   icon={Wind}
                   error={errors.tempAire}
                 />
               </div>

               <InputField 
                  label="Humedad Relativa" 
                  value={formData.humedadRelativa} 
                  onChange={(v) => handleInputChange('humedadRelativa', v)}
                  placeholder="0" 
                  unit="%" 
                  icon={Droplets}
                  error={errors.humedadRelativa}
               />

               <InputField 
                  label="CO2 Actual" 
                  value={formData.co2} 
                  onChange={(v) => handleInputChange('co2', v)}
                  placeholder="0.0" 
                  unit="%" 
                  icon={Activity}
                  error={errors.co2}
               />

               <div className="grid grid-cols-2 gap-4">
                 <InputField 
                    label="Volteo N°" 
                    value={formData.volteoNumero || ''} 
                    onChange={(v) => handleInputChange('volteoNumero', v)}
                    placeholder="0" 
                    unit="CANT" 
                    icon={RotateCw}
                    error={errors.volteoNumero}
                 />
                 <InputField 
                    label="Posición" 
                    value={formData.volteoPosicion || ''} 
                    onChange={(v) => handleInputChange('volteoPosicion', v)}
                    placeholder="0" 
                    unit="°" 
                    icon={RotateCw}
                    error={errors.volteoPosicion}
                 />
               </div>

               <AlarmToggle 
                 value={formData.alarma || ''} 
                 onChange={(v) => handleInputChange('alarma', v)} 
               />
            </>
          ) : (
            <>
               <InputField 
                  label="Temperatura" 
                  value={formData.temperatura || ''} 
                  onChange={(v) => handleInputChange('temperatura', v)}
                  placeholder="0.0" 
                  unit="°C" 
                  icon={Thermometer}
                  error={errors.temperatura}
               />
               <InputField 
                  label="Humedad Relativa" 
                  value={formData.humedadRelativa} 
                  onChange={(v) => handleInputChange('humedadRelativa', v)}
                  placeholder="0" 
                  unit="%" 
                  icon={Droplets}
                  error={errors.humedadRelativa}
               />
               <InputField 
                  label="CO2 Actual" 
                  value={formData.co2} 
                  onChange={(v) => handleInputChange('co2', v)}
                  placeholder="0.0" 
                  unit="%" 
                  icon={Activity}
                  error={errors.co2}
               />
            </>
          )}

          <div className="bg-white rounded-[2rem] p-6 border-2 border-gray-50 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gray-100 text-brand-gray">
                  <MessageSquare size={18} />
                </div>
                <label className="text-xs font-black text-brand-dark uppercase tracking-widest">Observaciones</label>
             </div>
             <textarea
                value={formData.observaciones}
                onChange={(e) => handleInputChange('observaciones', e.target.value)}
                placeholder="Escanea o escribe cualquier anomalía..."
                className="w-full bg-gray-50/50 border-2 border-gray-50 rounded-2xl px-5 py-4 text-sm text-brand-dark font-medium focus:outline-none focus:border-brand-primary transition-all min-h-[100px] resize-none"
             />
          </div>
        </div>
      </div>

      {/* Corporate Production Button */}
      <div className="absolute bottom-0 inset-x-0 p-8 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-40">
        <button 
          onClick={handleSave}
          className="w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 bg-brand-primary text-white active:scale-95 transition-all shadow-2xl shadow-brand-primary/30 uppercase tracking-widest"
        >
          <Save size={24} />
          GUARDAR PARÁMETROS
        </button>
        <p className="text-center text-[10px] text-brand-gray mt-4 font-black uppercase tracking-widest opacity-30">
          OPERARIO AUTORIZADO: {useMachineStore.getState().currentUser?.name?.toUpperCase() || 'SISTEMA'}
        </p>
      </div>
    </div>
  );
}

// Add Activity icon which was missing in imports
import { Activity } from 'lucide-react';
