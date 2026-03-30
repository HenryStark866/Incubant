import React, { useState, useCallback, useEffect } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, AlertCircle, Thermometer, Droplets, Calendar, RotateCw, Wind, Bell, MessageSquare, Activity, CheckCircle2, Egg } from 'lucide-react';

// Focus Fix: Move InputField component OUTSIDE the main render function
const DualInputField = React.memo(({ 
  label, real, sp, onChangeReal, onChangeSp, unit, icon: Icon, error 
}: { 
  label: string, 
  real: string,
  sp: string,
  onChangeReal: (val: string) => void, 
  onChangeSp: (val: string) => void, 
  unit: string,
  icon: any,
  error?: boolean
}) => {
  const diff = Math.abs(parseFloat(real || '0') - parseFloat(sp || '0'));
  const isAlarm = !isNaN(diff) && diff >= 1.5;

  return (
    <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${
      isAlarm ? 'border-red-400 bg-red-50/20' : error ? 'border-red-300 bg-red-50/5' : 'border-gray-100'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isAlarm ? 'bg-red-500 text-white' : 'bg-gray-50 text-brand-dark'}`}>
            <Icon size={18} />
          </div>
          <label className={`text-[11px] font-black uppercase tracking-widest ${isAlarm ? 'text-red-600' : 'text-brand-dark opacity-80'}`}>
            {label}
          </label>
        </div>
        
        {isAlarm && (
          <div className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-full animate-pulse uppercase tracking-widest shadow-sm">
            Alarma 1.5°F
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-6 relative">
        <div className="space-y-1">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Real</span>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={real}
            onChange={(e) => onChangeReal(e.target.value)}
            placeholder="0.0"
            className="w-full bg-transparent text-3xl font-black text-brand-dark focus:outline-none placeholder:text-gray-200 transition-all leading-none"
          />
        </div>
        
        <div className="space-y-1 relative pl-6 border-l border-gray-100">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Setpoint</span>
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={sp}
            onChange={(e) => onChangeSp(e.target.value)}
            placeholder="0.0"
            className="w-full bg-transparent text-xl font-bold text-gray-400 focus:outline-none placeholder:text-gray-200 transition-all leading-none"
          />
        </div>

        <div className="absolute right-0 bottom-1 flex items-center justify-center pointer-events-none opacity-20">
           <span className="text-[14px] font-black uppercase">{unit}</span>
        </div>
      </div>
    </div>
  );
});

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

// Specialized Select for Posicion de Volteo (V / A)
const PosicionToggle = ({ value, onChange, error }: { value: 'V' | 'A' | '', onChange: (v: 'V' | 'A') => void, error?: boolean }) => (
  <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between ${
    error ? 'border-red-400 bg-red-50/10' : 'border-gray-100'
  }`}>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gray-50 text-brand-dark">
        <RotateCw size={18} />
      </div>
      <label className="text-[11px] font-black text-brand-dark uppercase tracking-widest opacity-80">Posición de Volteo</label>
    </div>
    <div className="flex gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
      <button 
        onClick={() => onChange('V')} 
        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'V' ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
      >
        V
      </button>
      <button 
        onClick={() => onChange('A')} 
        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'A' ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
      >
        A
      </button>
    </div>
  </div>
);

// New Component for Time Input (Days/Hours/Minutes)
const TiempoIncubacionInput = ({ 
  value, 
  onChange, 
  error 
}: { 
  value: { dias: string, horas: string, minutos: string }, 
  onChange: (field: string, val: string) => void,
  error?: boolean 
}) => (
  <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${
    error ? 'border-red-400 bg-red-50/10' : 'border-gray-100'
  }`}>
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-xl ${error ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-brand-dark'}`}>
        <Calendar size={18} />
      </div>
      <label className="text-[11px] font-black text-brand-dark uppercase tracking-widest opacity-80">
        Tiempo de Incubación
      </label>
    </div>
    
    <div className="grid grid-cols-3 gap-3">
      <div className="flex flex-col items-center gap-1">
        <input
          type="number"
          value={value.dias}
          onChange={(e) => onChange('dias', e.target.value)}
          placeholder="00"
          className="w-full bg-gray-50 rounded-2xl py-3 text-center text-xl font-black text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Días</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <input
          type="number"
          value={value.horas}
          onChange={(e) => onChange('horas', e.target.value)}
          placeholder="00"
          className="w-full bg-gray-50 rounded-2xl py-3 text-center text-xl font-black text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Horas</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <input
          type="number"
          value={value.minutos}
          onChange={(e) => onChange('minutos', e.target.value)}
          placeholder="00"
          className="w-full bg-gray-50 rounded-2xl py-3 text-center text-xl font-black text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Min</span>
      </div>
    </div>
  </div>
);

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

// Generic Select for Si/No
const YesNoToggle = ({ label, icon: Icon, value, onChange, error }: { label: string, icon: any, value: 'Si' | 'No' | '', onChange: (v: 'Si' | 'No') => void, error?: boolean }) => (
  <div className={`bg-white rounded-3xl p-5 border-2 transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between ${
    error ? 'border-red-400 bg-red-50/10' : 'border-gray-100'
  }`}>
    <div className="flex items-center gap-3 max-w-[50%]">
      <div className="p-2 rounded-xl bg-gray-50 text-brand-dark">
        <Icon size={18} />
      </div>
      <label className="text-[10px] font-black text-brand-dark uppercase tracking-widest opacity-80 leading-tight">{label}</label>
    </div>
    <div className="flex gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
      <button 
        onClick={() => onChange('Si')} 
        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'Si' ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
      >
        SÍ
      </button>
      <button 
        onClick={() => onChange('No')} 
        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${value === 'No' ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
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
    tiempoIncubacion: { dias: '', horas: '', minutos: '' },
    // Incubadora
    tempOvoscanReal: '',
    tempOvoscanSP: '',
    tempAireReal: '',
    tempAireSP: '',
    // Nacedora
    tempSynchroReal: '',
    tempSynchroSP: '',
    temperaturaReal: '', 
    temperaturaSP: '',
    // Comunes
    humedadReal: '',
    humedadSP: '',
    co2Real: '',
    co2SP: '',
    
    volteoNumero: '',
    volteoPosicion: '',
    alarma: 'No',
    observaciones: '',
    ventiladorPrincipal: '' as any
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MachineData, boolean>>>({});
  const [showToast, setShowToast] = useState(false);

  const handleInputChange = useCallback((field: keyof MachineData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  }, [errors]);

  const handleTimeChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      tiempoIncubacion: {
        ...prev.tiempoIncubacion,
        [field]: value
      }
    }));
    if (errors.tiempoIncubacion) {
      setErrors(prev => ({ ...prev, tiempoIncubacion: false }));
    }
  };

  const handleSave = () => {
    const newErrors: Partial<Record<keyof MachineData, boolean>> = {};
    let hasErrors = false;

    // Campos comunes requeridos
    if (!formData.tiempoIncubacion.dias && !formData.tiempoIncubacion.horas && !formData.tiempoIncubacion.minutos) { 
      newErrors.tiempoIncubacion = true; hasErrors = true; 
    }
    if (isIncubadora) {
      if (!formData.tempOvoscanReal) { newErrors.tempOvoscanReal = true; hasErrors = true; }
      if (!formData.tempAireReal) { newErrors.tempAireReal = true; hasErrors = true; }
      if (!formData.volteoNumero) { newErrors.volteoNumero = true; hasErrors = true; }
    } else {
      if (!formData.tempSynchroReal) { newErrors.tempSynchroReal = true; hasErrors = true; }
      if (!formData.temperaturaReal) { newErrors.temperaturaReal = true; hasErrors = true; }
    }

    // Calcular alarma de 1.5°F para validación de observaciones
    const calculateDiff = (real?: string, sp?: string) => Math.abs(parseFloat(real || '0') - parseFloat(sp || '0'));
    
    const alarmOvo = isIncubadora ? calculateDiff(formData.tempOvoscanReal, formData.tempOvoscanSP) : calculateDiff(formData.tempSynchroReal, formData.tempSynchroSP);
    const alarmAire = isIncubadora ? calculateDiff(formData.tempAireReal, formData.tempAireSP) : calculateDiff(formData.temperaturaReal, formData.temperaturaSP);
    const alarmHumedad = calculateDiff(formData.humedadReal, formData.humedadSP);

    const hasCriticalAlarm = alarmOvo >= 1.5 || alarmAire >= 1.5 || alarmHumedad >= 1.5;

    if (hasCriticalAlarm && (!formData.observaciones || formData.observaciones.length < 5)) {
      alert("⚠️ ALARMA DETECTADA: Debes poner una observación detallada del motivo de la diferencia de temperatura/humedad.");
      newErrors.observaciones = true;
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      navigator.vibrate?.([100, 50, 100]);
      return;
    }

    setShowToast(true);
    navigator.vibrate?.(100);
    
    // Defer save to allow toast to render
    setTimeout(() => {
      saveMachineData(machine!.id, formData, capturedPhoto || '');
    }, 1500);
  };

  if (!machine) return null;

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
          
          <TiempoIncubacionInput 
            value={formData.tiempoIncubacion} 
            onChange={handleTimeChange}
            error={errors.tiempoIncubacion as any}
          />

          {isIncubadora ? (
            <>
              <DualInputField 
                label="Temp Ovoscan" 
                real={formData.tempOvoscanReal || ''} 
                sp={formData.tempOvoscanSP || ''}
                onChangeReal={(v) => handleInputChange('tempOvoscanReal', v)}
                onChangeSp={(v) => handleInputChange('tempOvoscanSP', v)}
                unit="°F" 
                icon={Thermometer}
                error={errors.tempOvoscanReal}
              />
              <DualInputField 
                label="Temp Aire" 
                real={formData.tempAireReal || ''} 
                sp={formData.tempAireSP || ''}
                onChangeReal={(v) => handleInputChange('tempAireReal', v)}
                onChangeSp={(v) => handleInputChange('tempAireSP', v)}
                unit="°F" 
                icon={Wind}
                error={errors.tempAireReal}
              />

              <DualInputField 
                label="Humedad Relativa" 
                real={formData.humedadReal || ''} 
                sp={formData.humedadSP || ''}
                onChangeReal={(v) => handleInputChange('humedadReal', v)}
                onChangeSp={(v) => handleInputChange('humedadSP', v)}
                unit="%" 
                icon={Droplets}
                error={errors.humedadReal}
              />

              <DualInputField 
                label="Nivel CO2" 
                real={formData.co2Real || ''} 
                sp={formData.co2SP || ''}
                onChangeReal={(v) => handleInputChange('co2Real', v)}
                onChangeSp={(v) => handleInputChange('co2SP', v)}
                unit="%" 
                icon={Activity}
                error={errors.co2Real}
              />

              <div className="grid grid-cols-2 gap-4">
                <InputField 
                  label="Número de Volteos" 
                  value={formData.volteoNumero || ''} 
                  onChange={(v) => handleInputChange('volteoNumero', v)}
                  placeholder="0" 
                  unit="CNT" 
                  icon={RotateCw}
                  error={errors.volteoNumero}
                />
                
                <PosicionToggle 
                  value={formData.volteoPosicion as any || ''} 
                  onChange={(v) => handleInputChange('volteoPosicion', v)}
                  error={errors.volteoPosicion}
                />
              </div>

              <YesNoToggle
                label="Ventilador/EcoDrive OK"
                icon={Wind}
                value={formData.ventiladorPrincipal || ''}
                onChange={(v) => handleInputChange('ventiladorPrincipal', v)}
                error={errors.ventiladorPrincipal}
              />
            </>
          ) : (
            <>
              {/* NACEDORA SPECIFIC FIELDS */}
              <DualInputField 
                label="Temp Synchrohatch" 
                real={formData.tempSynchroReal || ''} 
                sp={formData.tempSynchroSP || ''}
                onChangeReal={(v) => handleInputChange('tempSynchroReal', v)}
                onChangeSp={(v) => handleInputChange('tempSynchroSP', v)}
                unit="°F" 
                icon={Thermometer}
                error={errors.tempSynchroReal}
              />
              <DualInputField 
                label="Temp Aire" 
                real={formData.temperaturaReal || ''} 
                sp={formData.temperaturaSP || ''}
                onChangeReal={(v) => handleInputChange('temperaturaReal', v)}
                onChangeSp={(v) => handleInputChange('temperaturaSP', v)}
                unit="°F" 
                icon={Wind}
                error={errors.temperaturaReal}
              />

              <DualInputField 
                label="Humedad Relativa" 
                real={formData.humedadReal || ''} 
                sp={formData.humedadSP || ''}
                onChangeReal={(v) => handleInputChange('humedadReal', v)}
                onChangeSp={(v) => handleInputChange('humedadSP', v)}
                unit="%" 
                icon={Droplets}
                error={errors.humedadReal}
              />

              <DualInputField 
                label="Nivel CO2" 
                real={formData.co2Real || ''} 
                sp={formData.co2SP || ''}
                onChangeReal={(v) => handleInputChange('co2Real', v)}
                onChangeSp={(v) => handleInputChange('co2SP', v)}
                unit="%" 
                icon={Activity}
                error={errors.co2Real}
              />

              <YesNoToggle
                label="Ventilador/EcoDrive OK"
                icon={Wind}
                value={formData.ventiladorPrincipal || ''}
                onChange={(v) => handleInputChange('ventiladorPrincipal', v)}
                error={errors.ventiladorPrincipal}
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
