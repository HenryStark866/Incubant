import React, { useState, useEffect } from 'react';
import { Calendar, User, Clock, Trash2, Plus, Users, Save, CheckCircle2, AlertTriangle, ArrowRight, UserPlus, FileSpreadsheet, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl, apiFetch } from '../../lib/api';

type Shift = {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  color: string;
};

type User = {
  id: string;
  nombre: string;
  rol: string;
  turno: string;
};

type Assignment = {
  id: string;
  user_id: string;
  shift_id: string;
  fecha: string;
  user: { nombre: string };
  shift: { nombre: string; color: string };
};

export default function ShiftManager() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);

  // Estados para creación de turno nuevo
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [newShift, setNewShift] = useState({ nombre: '', hora_inicio: '06:00', hora_fin: '14:00', color: '#FF7A00' });

  const fetchData = async () => {
    try {
      const [sRes, uRes, aRes] = await Promise.all([
        apiFetch(getApiUrl('/api/admin/shifts')),
        apiFetch(getApiUrl('/api/admin/users')),
        apiFetch(getApiUrl('/api/admin/assignments'))
      ]);
      
      const shiftsJson = await sRes.json();
      const usersJson = await uRes.json();
      const assignmentsJson = await aRes.json();

      setShifts(Array.isArray(shiftsJson) ? shiftsJson : []);
      setUsers(Array.isArray(usersJson) ? usersJson : []);
      setAssignments(Array.isArray(assignmentsJson) ? assignmentsJson : []);
      
      // Auto-select first shift if none selected
      if (Array.isArray(shiftsJson) && shiftsJson.length > 0 && !selectedShift) {
        setSelectedShift(shiftsJson[0].id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setFeedback({ type: 'error', text: 'Error al conectar con el servidor' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedShift || !selectedDate) return;
    setIsSaving(true);
    try {
      const res = await apiFetch(getApiUrl('/api/admin/assignments'), {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUser,
          shift_id: selectedShift,
          fecha: selectedDate
        })
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Turno asignado correctamente' });
        fetchData();
      } else {
        setFeedback({ type: 'error', text: 'Error al asignar turno' });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error de red' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCreateShift = async () => {
    try {
      const res = await apiFetch(getApiUrl('/api/admin/shifts'), {
        method: 'POST',
        body: JSON.stringify(newShift)
      });
      if (res.ok) {
        setShowShiftForm(false);
        fetchData();
      }
    } catch (err) {
      console.error('Error creating shift:', err);
    }
  };

  const deleteAssignment = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta asignación?')) return;
    try {
      await apiFetch(getApiUrl(`/api/admin/assignments/${id}`), { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-[2.5rem] shadow-2xl p-8 overflow-hidden">
      
      {/* HEADER DE SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
         <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-brand-orange/10 p-2.5 rounded-2xl">
                 <Calendar className="w-6 h-6 text-brand-orange" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Gestión de Horarios</h2>
            </div>
            <p className="text-gray-500 text-sm font-medium pl-1">Organiza y asigna turnos al personal operativo.</p>
         </div>
         
         <button 
           onClick={() => setShowShiftForm(!showShiftForm)}
           className="flex items-center gap-2.5 bg-brand-primary text-white px-6 py-4 rounded-2xl font-black text-sm shadow-xl shadow-brand-primary/20 hover:scale-[1.03] transition-all"
         >
           <PlusCircle className="w-5 h-5" />
           CONFIGURAR TURNOS
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* PANEL DE ASIGNACIÓN */}
        <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
             <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                <UserPlus className="w-5 h-5 text-gray-400" />
             </div>
             <h3 className="font-bold text-gray-800 uppercase text-xs tracking-widest italic">Nueva Asignación</h3>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter pl-1">Operario</label>
               <select 
                 className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-gray-700 font-bold focus:ring-2 focus:ring-brand-orange/30 appearance-none shadow-inner"
                 value={selectedUser}
                 onChange={(e) => setSelectedUser(e.target.value)}
               >
                 <option value="">Seleccione un operario...</option>
                 {users.map(u => (
                   <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                 ))}
               </select>
            </div>

            <div className="grid gap-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter pl-1">Fecha de Turno</label>
               <input 
                 type="date"
                 className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-gray-700 font-bold focus:ring-2 focus:ring-brand-orange/30 shadow-inner"
                 value={selectedDate}
                 onChange={(e) => setSelectedDate(e.target.value)}
               />
            </div>

             <div className="grid gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter pl-1">Seleccionar Horario</label>
                <div className="grid grid-cols-2 gap-3">
                  {shifts.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedShift(s.id)}
                      className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all ${selectedShift === s.id ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/10' : 'bg-gray-50 border-gray-100'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                         <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: s.color || '#f5a623' }}></div>
                         <span className="font-black text-gray-800 text-xs">{s.nombre}</span>
                      </div>
                      <span className="text-[10px] text-brand-gray font-bold tracking-tight">{s.hora_inicio} - {s.hora_fin}</span>
                    </button>
                  ))}
                  {shifts.length === 0 && (
                    <div className="col-span-2 p-4 bg-orange-50 border border-orange-100 rounded-xl text-center">
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">No hay turnos creados</p>
                    </div>
                  )}
                </div>
             </div>
            
            <button 
              disabled={isSaving}
              onClick={handleCreateAssignment}
              className={`mt-4 w-full py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg transition-all ${isSaving ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]'}`}
            >
              {isSaving ? 'Guardando...' : <>VINCULAR TURNO <ArrowRight className="w-5 h-5" /></>}
            </button>
            
            <AnimatePresence>
               {feedback && (
                 <motion.div 
                   initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                   className={`p-4 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-2 ${feedback.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                 >
                   {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                   {feedback.text}
                 </motion.div>
               )}
            </AnimatePresence>
          </div>
        </section>

        {/* LISTA DE ASIGNACIONES ACTIVAS */}
        <section className="bg-white/60 rounded-[2rem] p-8 shadow-sm border border-white/50 flex flex-col h-[600px]">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                   <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-800 uppercase text-xs tracking-widest italic">Turnos Programados</h3>
             </div>
             <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] font-black text-gray-400">{assignments.length} TOTAL</span>
           </div>

           <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
             {assignments.map((asm) => (
               <div key={asm.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-brand-orange/30 transition-colors">
                  <div className="flex gap-4 items-center">
                    <div className="bg-gray-50 p-2 rounded-2xl border border-gray-100">
                       <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                        <h4 className="font-black text-gray-800 text-sm uppercase tracking-tighter">{asm.user.nombre}</h4>
                        <span className="text-[10px] text-brand-primary font-black px-2 py-0.5 bg-brand-primary/10 rounded-full border border-brand-primary/20">{asm.shift.nombre}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 font-bold italic tracking-wide">{new Date(asm.fecha).toLocaleDateString('es-CO', { dateStyle: 'long' })}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => deleteAssignment(asm.id)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
               </div>
             ))}
             
             {assignments.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-center p-10 opacity-30 select-none">
                  <FileSpreadsheet className="w-16 h-16 mb-4" />
                  <p className="font-bold uppercase tracking-widest text-sm italic">Cronograma Vacío</p>
                  <p className="text-xs mt-1">Comienza asignando turnos hoy.</p>
               </div>
             )}
           </div>
        </section>
      </div>

      {/* MODAL / FORM DE CREACIÓN DE TURNOS */}
      <AnimatePresence>
        {showShiftForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-gray-900/40 backdrop-blur-md"
               onClick={() => setShowShiftForm(false)}
            />
            <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10"
            >
               <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-4">
                  <div className="bg-brand-orange p-3 rounded-2xl shadow-lg shadow-brand-orange/30">
                     <Plus className="w-6 h-6 text-white" />
                  </div>
                  Crear Nuevo Turno
               </h3>

               <div className="space-y-6">
                  <div className="grid gap-2">
                     <label className="text-xs font-bold text-gray-400 uppercase pl-1 tracking-widest">Nombre del Turno</label>
                     <input 
                       type="text"
                       placeholder="Ej: Turno Mañana"
                       className="w-full bg-gray-50 border-0 rounded-2xl px-6 py-4 text-gray-800 font-bold focus:ring-2 focus:ring-brand-orange/30 shadow-inner"
                       value={newShift.nombre}
                       onChange={e => setNewShift({...newShift, nombre: e.target.value})}
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="grid gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase pl-1 tracking-widest">Inicio</label>
                        <input type="time" className="bg-gray-50 border-0 rounded-2xl px-5 py-4 font-bold shadow-inner" value={newShift.hora_inicio} onChange={e => setNewShift({...newShift, hora_inicio: e.target.value})} />
                     </div>
                     <div className="grid gap-2">
                        <label className="text-xs font-bold text-gray-400 uppercase pl-1 tracking-widest">Fin</label>
                        <input type="time" className="bg-gray-50 border-0 rounded-2xl px-5 py-4 font-bold shadow-inner" value={newShift.hora_fin} onChange={e => setNewShift({...newShift, hora_fin: e.target.value})} />
                     </div>
                  </div>

                   <div className="grid gap-4 mt-4">
                     <button onClick={handleCreateShift} className="w-full bg-brand-primary text-white py-5 rounded-3xl font-black shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        PUBLICAR TURNO
                     </button>
                     <button onClick={() => setShowShiftForm(false)} className="w-full py-4 rounded-2xl font-bold text-gray-400 hover:text-gray-600 transition-colors">
                        CANCELAR
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
