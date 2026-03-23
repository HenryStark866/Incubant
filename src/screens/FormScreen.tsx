import React, { useState, useCallback } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, AlertCircle, Thermometer, Droplets, Calendar, RotateCw, Type } from 'lucide-react';

// Focus Fix: Move InputField component OUTSIDE the main render function
// This prevents React from unmounting/remounting the input on every keystroke
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
  <div className="flex-1">
    <label className="block text-[11px] font-black text-brand-gray uppercase tracking-[0.2em] mb-2 px-1">
      <div className="flex items-center gap-1.5 leading-none">
        <Icon size={12} className="text-brand-primary" />
        {label}
      </div>
    </label>
    <div className="relative group">
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border-2 rounded-2xl px-5 py-4 text-xl font-black text-brand-dark transition-all shadow-sm ${
          error 
            ? 'border-red-500 bg-red-50 focus:ring-4 focus:ring-red-100' 
            : 'border-gray-100 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5'
        }`}
      />
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
         <span className={`text-xs font-black uppercase tracking-widest ${error ? 'text-red-400' : 'text-brand-gray opacity-40'}`}>
          {unit}
        </span>
      </div>
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

  // Memoized handlers for performance and consistency
  const handleInputChange = useCallback((field: keyof MachineData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  }, [errors]);

  const handleSave = () => {
    const newErrors: Partial<Record<keyof MachineData, boolean>> = {};
    let hasErrors = false;

    // Campos obligatorios para ambas
    if (!formData.temperatura) { newErrors.temperatura = true; hasErrors = true; }
    if (!formData.humedad) { newErrors.humedad = true; hasErrors = true; }
    if (!formData.diaIncubacion) { newErrors.diaIncubacion = true; hasErrors = true; }

    // Específico para incubadora
    if (machine?.type === 'incubadora' && !formData.numeroVolteos) {
      newErrors.numeroVolteos = true;
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      // Feedback táctico en dispositivo móvil
      navigator.vibrate?.(100);
      return;
    }

    saveMachineData(machine!.id, formData, capturedPhoto!);
  };

  if (!machine || !capturedPhoto) return null;

  const isIncubadora = machine.type === 'incubadora';

  return (
    <div className="flex flex-col h-full bg-white relative">
      
      {/* Dynamic Header with Real Logo */}
      <div className="bg-white border-b border-gray-100 p-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCapturedPhoto(null)}
            className="p-3 bg-gray-50 text-brand-gray rounded-2xl active:scale-90 transition-all border border-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
             <img src="/logo.png" alt="Incubant" className="h-7 w-auto mb-0.5" />
             <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] leading-none">
              {isIncubadora ? 'Incubadora' : 'Nacedora'} {machine.number}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[9px] font-black text-brand-gray uppercase tracking-widest leading-none mb-1 opacity-50">Registro Actual</p>
          <div className="px-3 py-1 bg-brand-primary/10 rounded-full border border-brand-primary/20">
             <p className="text-[9px] font-black text-brand-primary">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/30">
        
        {/* Photo Reference (Miniaturized for space) */}
        <div className="p-4">
          <div className="bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4 overflow-hidden group">
            <div className="relative w-32 h-24 rounded-[1.5rem] overflow-hidden border-2 border-gray-50 shadow-inner shrink-0 bg-brand-dark">
              <img src={capturedPhoto} alt="Captura" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black text-brand-dark uppercase tracking-widest mb-1.5 opacity-80">Referencia Visual</h4>
              <p className="text-[10px] text-brand-gray font-bold leading-relaxed pr-2">Asegúrate de que los valores ingresados coincidan con lo observado en el display de la máquina.</p>
            </div>
          </div>
        </div>

        {/* Validation Alert */}
        {Object.keys(errors).length > 0 && (
          <div className="mx-4 mb-4 animate-in fade-in slide-in-from-top-2">
            <div className="bg-red-50 border-2 border-red-100 p-4 rounded-3xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0 border border-red-100">
                <AlertCircle className="text-red-500" size={20} />
              </div>
              <div>
                <p className="text-sm font-black text-red-700">Faltan Datos Críticos</p>
                <p className="text-[11px] text-red-500 font-bold">Por favor completa los campos resaltados en rojo.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="p-4 space-y-6 pb-40">
          
          <div className="grid grid-cols-2 gap-4">
            <InputField 
              label="Temperatura" 
              value={formData.temperatura} 
              onChange={(v) => handleInputChange('temperatura', v)}
              placeholder="37.5" 
              unit="°C" 
              icon={Thermometer}
              error={errors.temperatura}
            />
            <InputField 
              label="Humedad" 
              value={formData.humedad} 
              onChange={(v) => handleInputChange('humedad', v)}
              placeholder="55.0" 
              unit="%" 
              icon={Droplets}
              error={errors.humedad}
            />
          </div>

          <div className="flex gap-4">
            <InputField 
              label="Día Actual" 
              value={formData.diaIncubacion} 
              onChange={(v) => handleInputChange('diaIncubacion', v)}
              placeholder="12" 
              unit="DÍA" 
              icon={Calendar}
              error={errors.diaIncubacion}
            />
            {isIncubadora ? (
              <InputField 
                label="N° Volteos" 
                value={formData.numeroVolteos || ''} 
                onChange={(v) => handleInputChange('numeroVolteos', v)}
                placeholder="4" 
                unit="CANT" 
                icon={RotateCw}
                error={errors.numeroVolteos}
              />
            ) : (
               <div className="flex-1">
                 <label className="block text-[11px] font-black text-brand-gray opacity-40 uppercase tracking-[0.2em] mb-2 px-1">Nacedora</label>
                 <div className="w-full bg-gray-100/50 border-2 border-dashed border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-center">
                    <p className="text-[10px] font-black text-brand-gray opacity-30 uppercase tracking-widest">Sin Volteos</p>
                 </div>
               </div>
            )}
          </div>

          <div className="pt-2">
            <label className="block text-[11px] font-black text-brand-gray uppercase tracking-[0.2em] mb-3 px-1">
               <div className="flex items-center gap-1.5">
                <Type size={12} className="text-brand-primary" />
                Observaciones Complementarias
              </div>
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => handleInputChange('observaciones', e.target.value)}
              placeholder="Ej: Se detectó ruido inusual en ventilador..."
              className="w-full bg-white border-2 border-gray-100 rounded-[2rem] px-6 py-5 text-base text-brand-dark font-medium focus:outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 transition-all min-h-[140px] resize-none shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Persistent Action Bar - Highly optimized for Mobile Thumb */}
      <div className="absolute bottom-0 inset-x-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] z-40">
        <button 
          onClick={handleSave}
          className="w-full py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 bg-brand-primary text-white active:bg-[#E6951F] active:scale-95 transition-all shadow-2xl shadow-brand-primary/30 uppercase tracking-[0.1em]"
        >
          <div className="p-2 bg-white/20 rounded-xl shadow-inner">
            <Save size={24} />
          </div>
          Guardar Registro
        </button>
        <p className="text-center text-[10px] text-brand-gray mt-4 font-black uppercase tracking-[0.2em] opacity-40">
          Autenticando como: {useMachineStore.getState().currentUser?.name || 'Operario'}
        </p>
      </div>
    </div>
  );
}
