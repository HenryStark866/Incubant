import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Bell, LogIn, ChevronRight } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '../lib/api';

type Assignment = {
  id: string;
  fecha: string;
  shift: {
    nombre: string;
    hora_inicio: string;
    hora_fin: string;
    color: string;
  };
};

export default function OperatorSchedule() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lastEvent } = useEvents(user?.id);

  const fetchSchedule = async () => {
    try {
      const res = await fetch(getApiUrl('/api/my-schedule'));
      const data = await res.json();
      setAssignments(data);
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(getApiUrl('/api/session'))
      .then(res => res.json())
      .then(data => setUser(data.user));
    
    fetchSchedule();
  }, []);

  // Escucha de eventos en tiempo real
  useEffect(() => {
    if (lastEvent?.type === 'NEW_ASSIGNMENT' || lastEvent?.type === 'SHIFT_UPDATE') {
      fetchSchedule();
    }
  }, [lastEvent]);

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50">Cargando horario...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="bg-white px-6 pt-12 pb-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Mi Cronograma</h1>
        <p className="text-sm text-gray-500 mt-1">Hola, {user?.name}. Revisa tus próximos turnos.</p>
      </header>

      <main className="px-6 mt-6 max-w-md mx-auto">
        {/* NOTIFICACION EN TIEMPO REAL */}
        <AnimatePresence>
          {lastEvent && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-brand-orange/10 border border-brand-orange/30 rounded-2xl flex gap-4 items-start shadow-sm"
            >
              <div className="bg-brand-orange p-2 rounded-xl">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-brand-orange text-sm italic tracking-wide uppercase">¡ALERTA DE TURNO!</h4>
                <p className="text-gray-700 text-sm mt-1">{lastEvent.message}</p>
                {lastEvent.type === 'LOGIN_REMINDER' && (
                  <button className="mt-2 text-xs font-bold text-brand-orange underline">INGRESAR AHORA</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LISTA DE TURNOS */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Próximos 7 días</h3>
          
          {assignments.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl text-center border-2 border-dashed border-gray-100">
               <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
               <p className="text-gray-400 text-sm">No tienes turnos asignados aún.</p>
            </div>
          ) : (
            assignments.map((asm, idx) => {
              const date = new Date(asm.fecha);
              const isToday = date.toDateString() === new Date().toDateString();

              return (
                <motion.div
                  key={asm.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative bg-white p-5 rounded-3xl shadow-sm border ${isToday ? 'border-brand-orange ring-1 ring-brand-orange/20' : 'border-gray-100'}`}
                >
                  {isToday && (
                    <span className="absolute -top-3 left-6 bg-brand-orange text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm">
                      HOY
                    </span>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center justify-center bg-gray-50 px-3 py-2 rounded-2xl min-w-[50px]">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">
                          {date.toLocaleDateString('es-CO', { weekday: 'short' })}
                        </span>
                        <span className="text-lg font-black text-gray-900">{date.getDate()}</span>
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{asm.shift.nombre}</h4>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asm.shift.color }}></span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs font-medium text-gray-500">
                            {asm.shift.hora_inicio} - {asm.shift.hora_fin}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isToday && (
                      <button className="flex items-center justify-center bg-gray-900 text-white w-10 h-10 rounded-2xl shadow-lg border border-white/20 active:scale-95 transition-transform"
                              onClick={() => window.location.href = '/incubadora-registro'}>
                        <LogIn className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </section>

        {/* BOTON DE REGRESO / SALIDA */}
        <footer className="mt-12 text-center">
           <p className="text-xs text-gray-400 mb-6 px-12 italic leading-relaxed">
             Asegúrate de registrar tu inicio de sesión al menos 5 minutos antes de comenzar.
           </p>
           <button 
             onClick={() => window.location.href = '/'}
             className="px-8 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 shadow-sm flex items-center gap-2 mx-auto hover:bg-gray-50 transition-colors"
           >
             Cerrar Panel
             <ChevronRight className="w-4 h-4" />
           </button>
        </footer>
      </main>
    </div>
  );
}
