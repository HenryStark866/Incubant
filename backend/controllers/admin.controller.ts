import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPin, verifyPin, validatePin } from '../services/auth.service';

const prisma = new PrismaClient();

export const seedShifts = async (req: Request, res: Response) => {
  try {
    // 1. Asegurar que los operarios existen con PINs hasheados
    const operatorNames = ['Juan Alejandro', 'Juan Suaza', 'Luis Cortes'];
    const users = await Promise.all(
      operatorNames.map(async (nombre) => {
        let user = await prisma.user.findFirst({ where: { nombre } });
        if (!user) {
          const tempPin = Math.floor(1000 + Math.random() * 9000).toString();
          const pinHash = await hashPin(tempPin);
          user = await prisma.user.create({
            data: {
              nombre,
              pin_hash: pinHash,
              rol: 'OPERARIO',
              turno: nombre === 'Juan Alejandro' ? 'Turno 3' : nombre === 'Juan Suaza' ? 'Turno 1' : 'Turno 2'
            }
          });
          console.log(`Usuario ${nombre} creado con PIN temporal: ${tempPin}`);
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

/**
 * GET /api/admin/users — Obtener lista de todos los usuarios
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nombre: true,
        rol: true,
        turno: true,
        estado: true,
        ultimo_acceso: true
      },
      orderBy: { id: 'asc' }
    });

    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error cargando usuarios' });
  }
};

/**
 * POST /api/admin/users — Crear nuevo usuario
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { nombre, pin, rol, turno } = req.body;

    // Validaciones
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (!pin) {
      return res.status(400).json({ error: 'El PIN es obligatorio' });
    }

    const pinValidation = validatePin(pin);
    if (!pinValidation.valid) {
      return res.status(400).json({ error: pinValidation.error });
    }

    if (!rol || !['OPERARIO', 'SUPERVISOR', 'JEFE'].includes(rol)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Verificar que no existe usuario con ese nombre
    const existing = await prisma.user.findFirst({ where: { nombre: nombre.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese nombre' });
    }

    // Hashear PIN
    const pinHash = await hashPin(pin);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        nombre: nombre.trim(),
        pin_hash: pinHash as any,
        rol,
        turno: turno || 'Turno 1',
        estado: 'Activo'
      } as any,
      select: {
        id: true,
        nombre: true,
        rol: true,
        turno: true,
        estado: true
      }
    });

    res.status(201).json({
      success: true,
      message: `Usuario ${nombre} creado exitosamente`,
      user
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creando usuario' });
  }
};

/**
 * PUT /api/admin/users/:id — Actualizar usuario
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, pin, rol, turno, estado } = req.body;

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updateData: any = {};

    if (nombre !== undefined) {
      if (nombre.trim().length === 0) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      updateData.nombre = nombre.trim();
    }

    if (pin !== undefined) {
      const pinValidation = validatePin(pin);
      if (!pinValidation.valid) {
        return res.status(400).json({ error: pinValidation.error });
      }
      updateData.pin_hash = await hashPin(pin);
    }

    if (rol !== undefined) {
      if (!['OPERARIO', 'SUPERVISOR', 'JEFE'].includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      updateData.rol = rol;
    }

    if (turno !== undefined) {
      updateData.turno = turno;
    }

    if (estado !== undefined) {
      if (!['Activo', 'Inactivo'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      updateData.estado = estado;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData as any,
      select: {
        id: true,
        nombre: true,
        rol: true,
        turno: true,
        estado: true
      }
    });

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: updatedUser
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error actualizando usuario' });
  }
};

/**
 * DELETE /api/admin/users/:id — Eliminar usuario
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Evitar que se elimine al mismo usuario
    const currentUser = (req as any).user;
    if (currentUser?.id === id) {
      return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: `Usuario ${user.nombre} eliminado exitosamente`
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
};
