import React, { useState, useCallback } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, AlertCircle, Thermometer, Droplets, Calendar, RotateCw, Fingerprint } from 'lucide-react';

// Focus Fix: Move InputField component OUTSIDE the main render function
const InputField = React.memo(({ 
  label, value, onChange, placeholder, unit, icon: Icon, error, disabled = false
}: { 
  label: string, 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string, 
  unit: string,
  icon: any,
  error?: boolean,
  disabled?: boolean
}) => (
  <div className={`bg-white rounded-[2rem] p-8 border-2 transition-all shadow-sm ${
    disabled ? 'opacity-40 grayscale pointer-events-none border-gray-100 bg-gray-50' : 
    error ? 'border-red-500 bg-red-50' : 'border-gray-50 bg-white shadow-brand-dark/5'
  }`}>
    <div className="flex items-center gap-3 mb-6">
      <div className={`p-3 rounded-2xl ${error ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-brand-gray'}`}>
        <Icon size={20} />
      </div>
      <label className="text-sm font-black text-brand-dark uppercase tracking-[0.1em]">
        {label}
      </label>
    </div>
    
    <div className="relative">
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-transparent text-4xl font-black text-brand-dark focus:outline-none placeholder:text-gray-200 transition-all ${
           error ? 'text-red-600' : ''
        }`}
      />
      <div className="absolute right-0 bottom-1 flex items-center gap-2 pointer-events-none">
         <span className={`text-xs font-black uppercase tracking-widest ${error ? 'text-red-400' : 'text-brand-gray opacity-30'}`}>
          {unit}
        </span>
      </div>
    </div>
    <div className={`h-1.5 w-full mt-4 rounded-full overflow-hidden ${disabled ? 'bg-gray-200' : 'bg-gray-50'}`}>
       <div className={`h-full transition-all duration-500 ${
         disabled ? 'w-0' :
         error ? 'bg-red-500 w-full' :
         value ? 'bg-brand-primary w-full' : 'w-0'
       }`}></div>
    </div>
  </div>
));

export default function FormScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const machines = useMachineStore(state => state.machines);
  const saveMachineData = useMachineStore(state => state.saveMachineData);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);

  const machine = machines.find(m => m.id === activeMachineId);

  const [formData, setFormData] = useState<MachineData>({
    temperatura: '',
    humedad: '',
    diaIncubacion: '',
    numeroVolteos: '',
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

    if (!formData.temperatura) { newErrors.temperatura = true; hasErrors = true; }
    if (!formData.humedad) { newErrors.humedad = true; hasErrors = true; }
    
    const isIncubadora = machine?.type === 'incubadora';
    
    if (isIncubadora) {
        if (!formData.diaIncubacion) { newErrors.diaIncubacion = true; hasErrors = true; }
        if (!formData.numeroVolteos) { newErrors.numeroVolteos = true; hasErrors = true; }
    }

    if (hasErrors) {
      setErrors(newErrors);
      navigator.vibrate?.(100);
      return;
    }

    saveMachineData(machine!.id, formData, capturedPhoto!);
  };

  if (!machine || !capturedPhoto) return null;

  const isIncubadora = machine.type === 'incubadora';

  return (
    <div className="flex flex-col h-full bg-[#F5F5F7] relative">
      
      {/* Professional Minimalist Header */}
      <div className="bg-white border-b border-gray-100 p-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => setCapturedPhoto(null)}
            className="p-3 bg-gray-50 text-brand-dark rounded-2xl active:scale-95 transition-all border border-gray-100"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="h-10 w-[1px] bg-gray-100"></div>
          <div>
             <h1 className="text-xl font-black text-brand-dark tracking-tighter">
               Registro: <span className="text-brand-primary">{isIncubadora ? 'Incubadora' : 'Nacedora'} {machine.number}</span>
             </h1>
             <p className="text-[10px] font-black text-brand-gray uppercase tracking-[0.2em] opacity-40">Planta de Incubación • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-44 space-y-6">
        
        {/* Photo Reference Tooltip-style */}
        <div className="relative group">
           <div className="absolute -top-3 left-8 bg-brand-dark text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full z-10 shadow-lg">Referencia Visual</div>
           <div className="w-full h-40 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl bg-brand-dark ring-1 ring-gray-100">
             <img src={capturedPhoto} alt="Captura" className="w-full h-full object-cover opacity-80" />
           </div>
        </div>

        {/* Form Fields as Cards */}
        <div className="space-y-6">
          <InputField 
            label="Temperatura" 
            value={formData.temperatura} 
            onChange={(v) => handleInputChange('temperatura', v)}
            placeholder="0.0" 
            unit="°C" 
            icon={Thermometer}
            error={errors.temperatura}
          />

          <InputField 
            label="Humedad" 
            value={formData.humedad} 
            onChange={(v) => handleInputChange('humedad', v)}
            placeholder="0" 
            unit="%" 
            icon={Droplets}
            error={errors.humedad}
          />

          {isIncubadora && (
            <>
              <InputField 
                label="Día de Incubación" 
                value={formData.diaIncubacion} 
                onChange={(v) => handleInputChange('diaIncubacion', v)}
                placeholder="0" 
                unit="DÍA" 
                icon={Calendar}
                error={errors.diaIncubacion}
              />
              <InputField 
                label="Número de Volteos" 
                value={formData.numeroVolteos || ''} 
                onChange={(v) => handleInputChange('numeroVolteos', v)}
                placeholder="0" 
                unit="CANT" 
                icon={RotateCw}
                error={errors.numeroVolteos}
              />
            </>
          )}

          <div className="bg-white rounded-[2.5rem] p-8 border-2 border-gray-50 shadow-sm shadow-brand-dark/5">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-gray-100 text-brand-gray">
                  <Fingerprint size={20} />
                </div>
                <label className="text-sm font-black text-brand-dark uppercase tracking-[0.1em]">Observaciones Técnicas</label>
             </div>
             <textarea
                value={formData.observaciones}
                onChange={(e) => handleInputChange('observaciones', e.target.value)}
                placeholder="Opcional..."
                className="w-full bg-gray-50/50 border-2 border-gray-50 rounded-2xl px-6 py-5 text-lg text-brand-dark font-medium focus:outline-none focus:border-brand-primary transition-all min-h-[120px] resize-none"
             />
          </div>
        </div>

        {/* Validation Feedback */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-500 text-white p-6 rounded-[2rem] flex items-center gap-4 shadow-xl shadow-red-500/20 animate-bounce">
            <AlertCircle size={28} />
            <p className="font-bold text-sm tracking-tight">Completa todos los campos obligatorios para continuar.</p>
          </div>
        )}
      </div>

      {/* Corporate Action Bar */}
      <div className="absolute bottom-0 inset-x-0 p-8 bg-white/90 backdrop-blur-2xl border-t border-gray-100 z-40">
        <button 
          onClick={handleSave}
          className="w-full py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 bg-brand-primary text-white active:scale-95 transition-all shadow-2xl shadow-brand-primary/40 uppercase tracking-[0.1em]"
        >
          <Save size={24} />
          Confirmar y Guardar
        </button>
        <div className="flex items-center justify-center gap-2 mt-5 opacity-40">
           <img src="/logo.png" alt="Incubant" className="h-3 grayscale" />
           <p className="text-[9px] font-black text-brand-gray uppercase tracking-widest">Genuino Incubant Monitor</p>
        </div>
      </div>
    </div>
  );
}
