import React, { useState, useCallback, useEffect } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  ChevronLeft, Save, AlertCircle, Thermometer, Droplets,
  Calendar, RotateCw, Wind, Bell, MessageSquare, Activity,
  CheckCircle2, Egg, Info, ShieldCheck, Zap, Loader2, Sun, Moon
} from 'lucide-react';

/* ── HUD Input Container ── */
const HudInput = ({ label, icon: Icon, error, children, isAlarm }: any) => {
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  return (
    <div className={`rounded-[1.5rem] p-5 border transition-all duration-300 relative ${
      isDark ? 'glass-card' : 'bg-white shadow-sm'
    } ${isAlarm ? 'border-red-500/40 glow-red' : error ? 'border-red-500/30 glow-red' : isDark ? 'border-white/5' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl transition-colors duration-300 ${
            isAlarm ? 'bg-red-500/20 text-red-400' : 'bg-brand-primary/10 text-brand-primary/50'
          }`}>
            <Icon size={14} />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] font-mono-display ${
            isAlarm ? 'text-red-400' : isDark ? 'text-white/40' : 'text-gray-500'
          }`}>
            {label}
          </span>
        </div>
        {isAlarm && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-500 text-[8px] font-black px-2 py-1 rounded-lg animate-pulse uppercase font-mono-display">
            ALERTA ±1.5°F
          </div>
        )}
      </div>
      {children}
      {isDark && (
        <>
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/5 rounded-tl-xl" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/5 rounded-br-xl" />
        </>
      )}
    </div>
  );
};

/* ── Dual Input Component ── */
const DualInputField = React.memo(({
  label, real, sp, onChangeReal, onChangeSp, unit, icon, error
}: any) => {
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const diff = Math.abs(parseFloat(real || '0') - parseFloat(sp || '0'));
  const isAlarm = !isNaN(diff) && diff >= 1.5;

  return (
    <HudInput label={label} icon={icon} error={error} isAlarm={isAlarm}>
      <div className="grid grid-cols-2 gap-4">
        <div className="relative">
          <div className={`text-[7px] font-black uppercase tracking-widest mb-1 font-mono ${isDark ? 'text-white/20' : 'text-gray-400'}`}>SENSOR_REAL</div>
          <input
            type="number" step="0.1" inputMode="decimal"
            value={real} onChange={e => onChangeReal(e.target.value)}
            placeholder="0.0"
            className={`w-full bg-transparent text-4xl font-black focus:outline-none placeholder:leading-none font-mono-display ${isDark ? 'text-white placeholder:text-white/5' : 'text-gray-900 placeholder:text-gray-300'}`}
          />
        </div>
        <div className={`pl-6 ${isDark ? 'border-l border-white/10' : 'border-l border-gray-200'}`}>
          <div className={`text-[7px] font-black uppercase tracking-widest mb-1 font-mono ${isDark ? 'text-white/20' : 'text-gray-400'}`}>
            SETPOINT <span className="text-brand-primary/60">({unit})</span>
          </div>
          <input
            type="number" step="0.1" inputMode="decimal"
            value={sp} onChange={e => onChangeSp(e.target.value)}
            placeholder="0.0"
            className={`w-full bg-transparent text-2xl font-black focus:outline-none focus:text-brand-primary placeholder:leading-none transition-all font-mono-display ${isDark ? 'text-white/40 placeholder:text-white/5' : 'text-gray-400 placeholder:text-gray-300'}`}
          />
        </div>
      </div>
    </HudInput>
  );
});

/* ── Single Input Component ── */
const InputField = React.memo(({
  label, value, onChange, placeholder, unit, icon, error
}: any) => {
  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  return (
    <HudInput label={label} icon={icon} error={error}>
      <div className="flex items-end gap-3">
        <input
          type="number" step="0.1" inputMode="decimal"
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 bg-transparent text-4xl font-black focus:outline-none placeholder:leading-none font-mono-display ${isDark ? 'text-white placeholder:text-white/5' : 'text-gray-900 placeholder:text-gray-300'}`}
        />
        <span className="text-[14px] font-black text-brand-primary/40 uppercase tracking-widest mb-1 font-mono-display">{unit}</span>
      </div>
    </HudInput>
  );
});

export default function FormScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto   = useMachineStore(state => state.capturedPhoto);
  const machines        = useMachineStore(state => state.machines);
  const saveMachineData = useMachineStore(state => state.saveMachineData);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);

  const theme = useThemeStore(state => state.theme);
  const toggleTheme = useThemeStore(state => state.toggleTheme);
  const isDark = theme === 'dark';

  const machine = machines.find(m => m.id === activeMachineId);
  const isIncubadora = machine?.type === 'incubadora';

  const [formData, setFormData] = useState<MachineData>({
    tiempoIncubacion: { dias: '', horas: '', minutos: '' },
    tempOvoscanReal: '', tempOvoscanSP: '',
    tempAireReal: '', tempAireSP: '',
    tempSynchroReal: '', tempSynchroSP: '',
    temperaturaReal: '', temperaturaSP: '',
    humedadReal: '', humedadSP: '',
    co2Real: '', co2SP: '',
    volteoNumero: '', volteoPosicion: '',
    alarma: 'No', observaciones: '',
    ventiladorPrincipal: '' as any
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MachineData, boolean>>>({});
  const [showToast, setShowToast] = useState(false);

  const handleInputChange = useCallback((field: keyof MachineData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  }, [errors]);

  const handleTimeChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, tiempoIncubacion: { ...prev.tiempoIncubacion, [field]: value } }));
    if (errors.tiempoIncubacion) setErrors(prev => ({ ...prev, tiempoIncubacion: false }));
  };

  const handleSave = async () => {
    const newErrors: any = {};
    let hasErrors = false;

    if (!formData.tiempoIncubacion.dias && !formData.tiempoIncubacion.horas && !formData.tiempoIncubacion.minutos) {
      newErrors.tiempoIncubacion = true; hasErrors = true;
    }
    if (isIncubadora) {
      if (!formData.tempOvoscanReal) { newErrors.tempOvoscanReal = true; hasErrors = true; }
      if (!formData.tempAireReal)    { newErrors.tempAireReal    = true; hasErrors = true; }
    } else {
      if (!formData.tempSynchroReal)  { newErrors.tempSynchroReal  = true; hasErrors = true; }
      if (!formData.temperaturaReal)  { newErrors.temperaturaReal  = true; hasErrors = true; }
    }

    const calc = (r?: string, s?: string) => Math.abs(parseFloat(r || '0') - parseFloat(s || '0'));
    const alarmOvo   = isIncubadora ? calc(formData.tempOvoscanReal, formData.tempOvoscanSP)   : calc(formData.tempSynchroReal, formData.tempSynchroSP);
    const alarmAire  = isIncubadora ? calc(formData.tempAireReal, formData.tempAireSP)          : calc(formData.temperaturaReal, formData.temperaturaSP);
    const alarmHum   = calc(formData.humedadReal, formData.humedadSP);
    const hasCritical = alarmOvo >= 1.5 || alarmAire >= 1.5 || alarmHum >= 1.5;

    if (hasCritical && (!formData.observaciones || formData.observaciones.length < 5)) {
      alert('⚠ ALERTA DE SISTEMA: Diferencia crítica detectada. Es obligatorio ingresar observaciones detalladas.');
      newErrors.observaciones = true; hasErrors = true;
    }

    if (hasErrors) { 
      setErrors(newErrors); 
      navigator.vibrate?.([100, 50, 100]); 
      return; 
    }

    setShowToast(true);
    navigator.vibrate?.(100);

    setTimeout(() => { saveMachineData(machine!.id, formData, capturedPhoto || ''); }, 500);
  };

  if (!machine) return null;
  const machineLabel = `${isIncubadora ? 'INC' : 'NAC'}-${String(machine.number).padStart(2, '0')}`;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className={`flex flex-col h-full relative overflow-hidden font-mono ${isDark ? 'bg-[#060b18]' : 'bg-gray-50'}`}>
      {/* HUD Background Decorations */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute inset-0 circuit-bg" />
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-brand-primary blur-[100px] opacity-10" />
        </div>
      )}

      {/* ── Header HUD ── */}
      <div className={`relative z-30 px-5 pt-12 pb-4 shrink-0 border-b backdrop-blur-3xl ${isDark ? 'glass-dark border-brand-primary/20' : 'bg-white/80 border-brand-primary/20'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCapturedPhoto(null)}
              className={`p-3 rounded-2xl border transition-all active:scale-90 ${isDark ? 'glass border-white/5 text-white/50 hover:text-white' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700'}`}
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1.5 opacity-60">
                <Egg size={12} className="text-brand-primary animate-pulse" />
                <span className={`text-[9px] font-black uppercase tracking-[0.3em] font-mono-display ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Protocolo de Registro</span>
              </div>
              <p className={`text-lg font-black leading-none font-mono-display tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isIncubadora ? 'INCUBADORA' : 'NACEDORA'} <span className="holo-text">{machineLabel}</span>
              </p>
            </div>
          </div>
          <button onClick={toggleTheme} className={`p-3 rounded-2xl border transition-all active:scale-90 ${isDark ? 'glass border-white/5 text-white/50 hover:text-brand-primary' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-brand-primary'}`}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-40 space-y-4 relative z-10 scrollbar-hide">
        {/* Toast State Overlay */}
        {showToast && (
          <div className="fixed top-24 inset-x-5 z-50 animate-slide-down">
            <div className="glass-light rounded-3xl p-5 border border-green-500/50 glow-green flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center animate-bounce">
                <CheckCircle2 size={24} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white uppercase font-mono-display">TRANSMISIÓN EXITOSA</p>
                <p className="text-[10px] text-green-400/60 font-mono tracking-widest">Datos guardados localmente</p>
              </div>
            </div>
          </div>
        )}

        {/* Global Alert Notification */}
        {hasErrors && !showToast && (
          <div className="glass rounded-2xl p-4 border border-red-500/30 glow-red animate-pulse flex items-center gap-3">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest font-mono-display">Detección de errores: Verifique todos los sensores requeridos</p>
          </div>
        )}

        {/* ── Captured Evidence Preview ── */}
        <div className="glass-card rounded-[1.5rem] overflow-hidden border border-brand-primary/20 relative group h-24">
          <img src={capturedPhoto} alt="Evidencia" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-brand-dark/90 flex items-center justify-end pr-5">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] font-mono">EVIDENCE_HASH</div>
                <div className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em] font-mono-display">SENSOR_LINKED_OK</div>
              </div>
              <div className="w-1.5 h-6 bg-brand-primary animate-pulse" />
            </div>
          </div>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-brand-dark/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
             <div className="w-1 h-1 bg-red-500 rounded-full animate-blink" />
             <span className="text-[7px] font-black text-white/40 font-mono tracking-widest uppercase">REC_LIVE</span>
          </div>
        </div>

        {/* ── Time Configuration ── */}
        <HudInput label="TIEMPO_DE_PROCESO" icon={Calendar} error={errors.tiempoIncubacion}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'DIAS', field: 'dias' },
              { label: 'HORAS', field: 'horas' },
              { label: 'MIN', field: 'minutos' },
            ].map((item, idx) => (
              <div key={item.label} className="relative group text-center">
                <div className="text-[7px] font-black text-white/15 mb-2 font-mono">{item.label}</div>
                <input
                  type="number" value={(formData.tiempoIncubacion as any)[item.field]}
                  onChange={e => handleTimeChange(item.field, e.target.value)}
                  placeholder="00"
                  className="w-full glass rounded-2xl py-3.5 text-center text-2xl font-black text-white focus:outline-none focus:ring-1 focus:ring-brand-primary/40 border border-white/5 font-mono-display"
                />
                {idx < 2 && <div className="absolute top-1/2 -right-[1px] translate-y-1 w-[1px] h-4 bg-white/5" />}
              </div>
            ))}
          </div>
        </HudInput>

        {isIncubadora ? (
          <>
            <DualInputField label="T. OVOSCAN" real={formData.tempOvoscanReal} sp={formData.tempOvoscanSP}
              onChangeReal={(v:any) => handleInputChange('tempOvoscanReal', v)} onChangeSp={(v:any) => handleInputChange('tempOvoscanSP', v)}
              unit="°F" icon={Thermometer} error={errors.tempOvoscanReal} />
            <DualInputField label="T. FLUJO_AIRE" real={formData.tempAireReal} sp={formData.tempAireSP}
              onChangeReal={(v:any) => handleInputChange('tempAireReal', v)} onChangeSp={(v:any) => handleInputChange('tempAireSP', v)}
              unit="°F" icon={Wind} error={errors.tempAireReal} />
            <DualInputField label="HUMEDAD_RELAT." real={formData.humedadReal} sp={formData.humedadSP}
              onChangeReal={(v:any) => handleInputChange('humedadReal', v)} onChangeSp={(v:any) => handleInputChange('humedadSP', v)}
              unit="%" icon={Droplets} error={errors.humedadReal} />
            <DualInputField label="NIVEL_CO2" real={formData.co2Real} sp={formData.co2SP}
              onChangeReal={(v:any) => handleInputChange('co2Real', v)} onChangeSp={(v:any) => handleInputChange('co2SP', v)}
              unit="PPM" icon={Activity} error={errors.co2Real} />
            
            <div className="grid grid-cols-2 gap-3">
              <InputField label="N°_VOLTEOS" value={formData.volteoNumero} onChange={(v:any) => handleInputChange('volteoNumero', v)}
                placeholder="0" unit="CNT" icon={RotateCw} error={errors.volteoNumero} />
              
              <HudInput label="POSICIÓN" icon={RotateCw}>
                <div className="flex gap-2 p-1 rounded-xl glass border border-white/5">
                  {['V', 'A'].map(opt => (
                    <button key={opt} onClick={() => handleInputChange('volteoPosicion', opt)}
                      className={`flex-1 py-3 text-xs font-black rounded-lg transition-all tracking-widest font-mono-display ${
                        formData.volteoPosicion === opt ? 'text-white shadow-lg' : 'text-white/20'
                      }`}
                      style={formData.volteoPosicion === opt ? { background: 'linear-gradient(135deg, #f7931a, #ffb800)' } : {}}>
                      {opt}
                    </button>
                  ))}
                </div>
              </HudInput>
            </div>
          </>
        ) : (
          <>
            <DualInputField label="T. SYNCHROHATCH" real={formData.tempSynchroReal} sp={formData.tempSynchroSP}
              onChangeReal={(v:any) => handleInputChange('tempSynchroReal', v)} onChangeSp={(v:any) => handleInputChange('tempSynchroSP', v)}
              unit="°F" icon={Thermometer} error={errors.tempSynchroReal} />
            <DualInputField label="T. FLUJO_AIRE" real={formData.temperaturaReal} sp={formData.temperaturaSP}
              onChangeReal={(v:any) => handleInputChange('temperaturaReal', v)} onChangeSp={(v:any) => handleInputChange('temperaturaSP', v)}
              unit="°F" icon={Wind} error={errors.temperaturaReal} />
            <DualInputField label="HUMEDAD_RELAT." real={formData.humedadReal} sp={formData.humedadSP}
              onChangeReal={(v:any) => handleInputChange('humedadReal', v)} onChangeSp={(v:any) => handleInputChange('humedadSP', v)}
              unit="%" icon={Droplets} error={errors.humedadReal} />
            <DualInputField label="NIVEL_CO2" real={formData.co2Real} sp={formData.co2SP}
              onChangeReal={(v:any) => handleInputChange('co2Real', v)} onChangeSp={(v:any) => handleInputChange('co2SP', v)}
              unit="PPM" icon={Activity} error={errors.co2Real} />
          </>
        )}

        {/* ── Status Toggles ── */}
        <div className="grid grid-cols-2 gap-3">
          <HudInput label="ECO_DRIVE_OK" icon={Wind} error={errors.ventiladorPrincipal}>
            <div className="flex gap-2 p-1 rounded-xl glass border border-white/5">
              {[ 'Si', 'No' ].map(opt => (
                <button key={opt} onClick={() => handleInputChange('ventiladorPrincipal', opt)}
                  className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all tracking-widest font-mono-display ${
                    formData.ventiladorPrincipal === opt ? 'text-white' : 'text-white/20'
                  }`}
                  style={formData.ventiladorPrincipal === opt ? { background: 'linear-gradient(135deg, #f7931a, #ffb800)' } : {}}>
                  {opt === 'Si' ? 'PROC_OK' : 'FAIL'}
                </button>
              ))}
            </div>
          </HudInput>
          <HudInput label="SISTEMA_ALARM" icon={Bell}>
            <div className="flex gap-2 p-1 rounded-xl glass border border-white/5">
              {[ 'Si', 'No' ].map(opt => (
                <button key={opt} onClick={() => handleInputChange('alarma', opt)}
                  className={`flex-1 py-2.5 text-[9px] font-black rounded-lg transition-all tracking-widest font-mono-display ${
                    formData.alarma === opt ? (opt === 'Si' ? 'bg-red-500 text-white glow-red' : 'bg-green-500 text-white shadow-lg') : 'text-white/20'
                  }`}>
                  {opt === 'Si' ? 'ACTIVE' : 'IDLE'}
                </button>
              ))}
            </div>
          </HudInput>
        </div>

        {/* ── Observations HUB ── */}
        <HudInput label="REGISTRO_DE_INCIDENCIAS" icon={MessageSquare} error={errors.observaciones}>
           <textarea
            value={formData.observaciones}
            onChange={e => handleInputChange('observaciones', e.target.value)}
            placeholder="Ingrese reporte técnico de anomalías detectadas..."
            className="w-full glass rounded-2xl px-5 py-4 text-sm text-white font-medium placeholder:text-white/10
                       focus:outline-none focus:ring-1 focus:ring-brand-primary/30 transition-all
                       min-h-[120px] resize-none border border-white/5 font-mono"
            style={{ appearance: 'none' }}
          />
          <div className="flex items-center gap-3 mt-3 opacity-30">
            <Info size={12} className="text-white" />
            <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em]">Obligatorio en niveles críticos ±1.5°F</span>
          </div>
        </HudInput>
      </div>

      {/* ── Transmission Logic Fixed Footer ── */}
      <div className="absolute bottom-0 inset-x-0 z-40 p-5 pt-10"
        style={{ background: 'linear-gradient(to top, #060b18 60%, transparent)' }}>
        <button
          onClick={handleSave}
          disabled={showToast}
          className="w-full py-5 rounded-3xl font-black text-sm flex items-center justify-center gap-4
                     transition-all uppercase tracking-widest active:scale-95 disabled:opacity-40 font-mono-display"
          style={{
            background: showToast
              ? 'rgba(34,197,94,0.1)'
              : 'linear-gradient(135deg, #f7931a 0%, #ffb800 100%)',
            boxShadow: showToast ? 'none' : '0 0 40px rgba(247,147,26,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
            border: showToast ? '1px solid rgba(34,197,94,0.3)' : 'none'
          }}
        >
          {showToast ? (
            <><Loader2 size={24} className="animate-spin text-green-400" /><span className="text-green-400 animate-pulse">TRANSMISIÓN EN CURSO...</span></>
          ) : (
            <><Zap size={22} className="text-white" /><span className="text-white">SINCRONIZAR REGISTRO</span></>
          )}
        </button>
      </div>
    </div>
  );
}
