import React, { useState } from 'react';
import { useMachineStore, MachineData } from '../store/useMachineStore';
import { ChevronLeft, Save, CheckSquare, Square, AlertCircle } from 'lucide-react';

export default function FormScreen() {
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const machines = useMachineStore(state => state.machines);
  const saveMachineData = useMachineStore(state => state.saveMachineData);
  const setCapturedPhoto = useMachineStore(state => state.setCapturedPhoto);

  const machine = machines.find(m => m.id === activeMachineId);

  const [formData, setFormData] = useState<MachineData>({
    tempPrincipalActual: '',
    tempPrincipalConsigna: '',
    co2Actual: '',
    co2Consigna: '',
    ventiladorVelocidad: '',
    tempSecundariaActual: '',
    tempSecundariaConsigna: '',
    tempSuperiorActual: '',
    tempSuperiorNA: false,
    observaciones: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MachineData, boolean>>>({});

  if (!machine || !capturedPhoto) return null;

  const handleChange = (field: keyof MachineData, value: string | boolean) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Si marcamos N/A, limpiamos el error de ese campo y su valor
      if (field === 'tempSuperiorNA' && value === true) {
        newData.tempSuperiorActual = '';
        setErrors(e => ({ ...e, tempSuperiorActual: false }));
      }
      return newData;
    });
    // Limpiar error al escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = () => {
    // Validación
    const newErrors: Partial<Record<keyof MachineData, boolean>> = {};
    let hasErrors = false;

    const requiredFields: (keyof MachineData)[] = [
      'tempPrincipalActual', 'tempPrincipalConsigna',
      'co2Actual', 'co2Consigna',
      'ventiladorVelocidad',
      'tempSecundariaActual', 'tempSecundariaConsigna'
    ];

    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = true;
        hasErrors = true;
      }
    });

    if (!formData.tempSuperiorNA && !formData.tempSuperiorActual) {
      newErrors.tempSuperiorActual = true;
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      // Scroll to top or show toast in a real app
      return;
    }

    // Guardar y Firmar
    saveMachineData(machine.id, formData, capturedPhoto);
  };

  const InputField = ({ 
    label, field, placeholder, unit 
  }: { 
    label: string, field: keyof MachineData, placeholder: string, unit: string 
  }) => (
    <div className="flex-1">
      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={formData[field] as string}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white border-2 rounded-xl px-4 py-3 text-lg font-bold text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all ${
            errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'
          }`}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-md z-20 flex items-center gap-3 sticky top-0">
        <button 
          onClick={() => setCapturedPhoto(null)}
          className="p-2 bg-blue-700 rounded-full active:bg-blue-800 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Registro de Parámetros</h1>
          <p className="text-blue-200 text-sm">
            {machine.type === 'incubadora' ? 'Incubadora' : 'Nacedora'} {machine.number}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Photo Reference */}
        <div className="bg-gray-900 p-4 flex justify-center shadow-inner">
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-700 max-h-[120px]">
            <img src={capturedPhoto} alt="Referencia" className="h-full w-auto object-contain" />
            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 text-center font-mono">
              Captura en vivo
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 flex flex-col gap-6">
          
          {Object.keys(errors).length > 0 && (
            <div className="bg-red-100 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm font-bold border border-red-200">
              <AlertCircle size={18} />
              Por favor completa los campos marcados en rojo.
            </div>
          )}

          {/* Sección Roja: Temp Principal */}
          <div className="bg-red-50/50 border-2 border-red-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-red-800 font-black mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              Temperatura Principal
            </h3>
            <div className="flex gap-3">
              <InputField label="Actual" field="tempPrincipalActual" placeholder="100.5" unit="°F" />
              <InputField label="Consigna" field="tempPrincipalConsigna" placeholder="100.4" unit="°F" />
            </div>
          </div>

          {/* Sección Amarilla: CO2 */}
          <div className="bg-yellow-50/50 border-2 border-yellow-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-yellow-800 font-black mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              Niveles de CO2
            </h3>
            <div className="flex gap-3">
              <InputField label="Actual" field="co2Actual" placeholder="0.10" unit="%" />
              <InputField label="Consigna" field="co2Consigna" placeholder="0.10" unit="%" />
            </div>
          </div>

          {/* Sección Verde: Ventilación */}
          <div className="bg-green-50/50 border-2 border-green-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-green-800 font-black mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              Ventilación (Fan)
            </h3>
            <div className="flex gap-3">
              <InputField label="Velocidad" field="ventiladorVelocidad" placeholder="1" unit="%" />
              <div className="flex-1"></div> {/* Spacer to keep input size consistent */}
            </div>
          </div>

          {/* Sección Azul: Temp Secundaria */}
          <div className="bg-blue-50/50 border-2 border-blue-100 rounded-2xl p-4 shadow-sm">
            <h3 className="text-blue-800 font-black mb-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              Temperatura Secundaria
            </h3>
            <div className="flex gap-3">
              <InputField label="Actual" field="tempSecundariaActual" placeholder="95.2" unit="°F" />
              <InputField label="Consigna" field="tempSecundariaConsigna" placeholder="94.0" unit="°F" />
            </div>
          </div>

          {/* Sección Rosa: Temp Superior (Manejo N/A) */}
          <div className="bg-pink-50/50 border-2 border-pink-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-pink-800 font-black flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                Temperatura Superior
              </h3>
              
              <button 
                onClick={() => handleChange('tempSuperiorNA', !formData.tempSuperiorNA)}
                className="flex items-center gap-1.5 text-sm font-bold text-gray-600 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm active:bg-gray-50"
              >
                {formData.tempSuperiorNA ? (
                  <CheckSquare size={18} className="text-blue-600" />
                ) : (
                  <Square size={18} className="text-gray-400" />
                )}
                Datos No Legibles (N/A)
              </button>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={formData.tempSuperiorNA}
                  value={formData.tempSuperiorActual as string}
                  onChange={(e) => handleChange('tempSuperiorActual', e.target.value)}
                  placeholder={formData.tempSuperiorNA ? "---" : "99.8"}
                  className={`w-full border-2 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none transition-all ${
                    formData.tempSuperiorNA 
                      ? 'bg-gray-100 border-gray-200 text-gray-400' 
                      : errors.tempSuperiorActual 
                        ? 'border-red-500 bg-red-50 text-gray-800' 
                        : 'bg-white border-gray-200 text-gray-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 font-bold ${formData.tempSuperiorNA ? 'text-gray-300' : 'text-gray-400'}`}>
                  °F
                </span>
              </div>
              <div className="flex-1"></div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-gray-800 font-black mb-3">Observaciones (Opcional)</h3>
            <textarea
              value={formData.observaciones}
              onChange={(e) => handleChange('observaciones', e.target.value)}
              placeholder="Escribe aquí cualquier anomalía..."
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all min-h-[100px] resize-none"
            />
          </div>

        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
        <button 
          onClick={handleSave}
          className="w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 bg-blue-600 text-white active:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
        >
          <Save size={22} />
          Guardar y Firmar
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
          Firmado digitalmente por: {useMachineStore.getState().currentUser?.name || 'Operario'}
        </p>
      </div>
    </div>
  );
}
