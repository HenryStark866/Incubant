import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedShifts = async (req: Request, res: Response) => {
  try {
    // 1. Asegurar que los operarios existen
    const operatorNames = ['Juan Alejandro', 'Juan Suaza', 'Luis Cortes'];
    const users = await Promise.all(
      operatorNames.map(async (nombre) => {
        let user = await prisma.user.findFirst({ where: { nombre } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              nombre,
              pin_acceso: Math.floor(1000 + Math.random() * 9000).toString(), // PIN inicial aleatorio
              rol: 'OPERARIO',
              turno: nombre === 'Juan Alejandro' ? 'Turno 3' : nombre === 'Juan Suaza' ? 'Turno 1' : 'Turno 2'
            }
          });
        }
        return user;
      })
    );

    const [jAlejandro, jSuaza, lCortes] = users;

    // 2. Asegurar que los turnos existen
    const shiftDefs = [
      { nombre: 'Turno 1', hora_inicio: '06:20', hora_fin: '14:40', color: '#10b981' }, // Mañana
      { nombre: 'Turno 2', hora_inicio: '14:40', hora_fin: '22:20', color: '#3b82f6' }, // Tarde
      { nombre: 'Turno 3', hora_inicio: '22:20', hora_fin: '06:20', color: '#6366f1' }  // Noche
    ];

    const shifts = await Promise.all(
      shiftDefs.map(async (s) => {
        let shift = await prisma.shift.findUnique({ where: { nombre: s.nombre } });
        if (!shift) {
          shift = await prisma.shift.create({ data: s });
        }
        return shift;
      })
    );

    const [t1, t2, t3] = shifts;

    // 3. Generar asignaturas para la quincena actual (del 30 de marzo al 15 de abril)
    const startDate = new Date('2026-03-30');
    const endDate = new Date('2026-04-15');

    // Asignaciones por cada operario
    const assignments = [];

    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfMonth = current.getDate();

      // Regla de Descanso: 2 días consecutivos
      // Juan Alejandro descansa 1 y 2 de abril
      // Juan Suaza descansa 5 y 6 de abril
      // Luis Cortes descansa 9 y 10 de abril

      // Juan Alejandro (Turno 3 - Noche)
      if (!(dayOfMonth === 1 || dayOfMonth === 2)) {
        assignments.push({ user_id: jAlejandro.id, shift_id: t3.id, fecha: new Date(dateStr) });
      }

      // Juan Suaza (Turno 1 - Mañana)
      if (!(dayOfMonth === 5 || dayOfMonth === 6)) {
        assignments.push({ user_id: jSuaza.id, shift_id: t1.id, fecha: new Date(dateStr) });
      }

      // Luis Cortes (Turno 2 - Tarde)
      if (!(dayOfMonth === 9 || dayOfMonth === 10)) {
        assignments.push({ user_id: lCortes.id, shift_id: t2.id, fecha: new Date(dateStr) });
      }

      current.setDate(current.getDate() + 1);
    }

    // 4. Insertar asignaciones (evitando duplicados por fecha)
    for (const assignment of assignments) {
      await prisma.scheduleAssignment.upsert({
        where: {
          user_id_fecha: {
            user_id: assignment.user_id,
            fecha: assignment.fecha
          }
        },
        update: {
          shift_id: assignment.shift_id
        },
        create: assignment
      });
    }

    res.json({
      success: true,
      message: `Horarios generados del 30 de marzo al 15 de abril para ${operatorNames.join(', ')}`,
      details: {
        totalAssignments: assignments.length,
        shifts: shiftDefs.length,
        users: operatorNames.length
      }
    });

  } catch (error: any) {
    console.error('Error al sembrar turnos:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await prisma.$disconnect();
  }
};
