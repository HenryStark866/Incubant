import { type Request, type Response } from 'express';
import { getPrismaClient as getPrisma } from '../prisma';

type AuthenticatedRequest = any;

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/chat/conversations
// Crear una nueva conversación (privada o grupal)
// ──────────────────────────────────────────────────────────────────────────────
export const createConversation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { recipientIds, titulo, tipo } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
            return res.status(400).json({ error: 'Se requieren destinatarios' });
        }

        const prisma = await getPrisma();

        // Para conversaciones privadas 1:1
        if (recipientIds.length === 1 && tipo === 'PRIVADO') {
            const recipientId = recipientIds[0];

            // Verificar si ya existe una conversación entre estos dos
            const existing = await prisma.conversation.findFirst({
                where: {
                    tipo: 'PRIVADO',
                    participants: {
                        every: {
                            user_id: {
                                in: [userId, recipientId]
                            }
                        }
                    }
                },
                include: {
                    participants: true,
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (existing) {
                return res.json(existing);
            }
        }

        // Crear nueva conversación
        const conversation = await prisma.conversation.create({
            data: {
                titulo,
                tipo: tipo || 'PRIVADO',
                participants: {
                    createMany: {
                        data: [
                            { user_id: userId },
                            ...recipientIds.map(id => ({ user_id: id }))
                        ]
                    }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                nombre: true,
                                rol: true,
                                turno: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        res.status(201).json(conversation);
    } catch (error) {
        console.error('[Chat] Error creando conversación:', error);
        res.status(500).json({ error: 'Error creando conversación' });
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations
// Obtener todas las conversaciones del usuario
// ──────────────────────────────────────────────────────────────────────────────
export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const prisma = await getPrisma();

        const conversations = await prisma.conversation.findMany({
            where: {
                participants: {
                    some: {
                        user_id: userId
                    }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                nombre: true,
                                rol: true,
                                turno: true
                            }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        res.json(conversations);
    } catch (error) {
        console.error('[Chat] Error obteniendo conversaciones:', error);
        res.status(500).json({ error: 'Error obteniendo conversaciones' });
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id/messages
// Obtener mensajes de una conversación
// ──────────────────────────────────────────────────────────────────────────────
export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const prisma = await getPrisma();

        // Verificar que el usuario es participante
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: id,
                    user_id: userId
                }
            }
        });

        if (!isParticipant) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const messages = await prisma.message.findMany({
            where: { conversation_id: id },
            include: {
                sender: {
                    select: {
                        id: true,
                        nombre: true,
                        rol: true,
                        turno: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string)
        });

        res.json(messages.reverse());
    } catch (error) {
        console.error('[Chat] Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error obteniendo mensajes' });
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/chat/messages
// Enviar un mensaje
// ──────────────────────────────────────────────────────────────────────────────
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { conversation_id, contenido } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        if (!conversation_id || !contenido) {
            return res.status(400).json({ error: 'conversation_id y contenido son requeridos' });
        }

        const prisma = await getPrisma();

        // Verificar que el usuario es participante
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id,
                    user_id: userId
                }
            }
        });

        if (!isParticipant) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const message = await prisma.message.create({
            data: {
                conversation_id,
                sender_id: userId,
                contenido
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        nombre: true,
                        rol: true
                    }
                }
            }
        });

        // Actualizar updatedAt de la conversación
        await prisma.conversation.update({
            where: { id: conversation_id },
            data: { updatedAt: new Date() }
        });

        // Notificar via SSE
        void (async () => {
            try {
                const { sendEventToAll } = await import('../services/event.service');
                sendEventToAll({
                    type: 'NEW_MESSAGE',
                    message: `Nuevo mensaje de ${message.sender.nombre}`,
                    conversationId: conversation_id,
                    timestamp: new Date().toISOString()
                });
            } catch (e) {
                console.warn('[Chat SSE] Error en notificación:', e);
            }
        })();

        res.status(201).json(message);
    } catch (error) {
        console.error('[Chat] Error enviando mensaje:', error);
        res.status(500).json({ error: 'Error enviando mensaje' });
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/messages/:id
// Eliminar un mensaje
// ──────────────────────────────────────────────────────────────────────────────
export const deleteMessage = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const prisma = await getPrisma();

        const message = await prisma.message.findUnique({
            where: { id }
        });

        if (!message) {
            return res.status(404).json({ error: 'Mensaje no encontrado' });
        }

        if (message.sender_id !== userId) {
            return res.status(403).json({ error: 'No puede eliminar este mensaje' });
        }

        await prisma.message.delete({
            where: { id }
        });

        res.json({ message: 'Mensaje eliminado' });
    } catch (error) {
        console.error('[Chat] Error eliminando mensaje:', error);
        res.status(500).json({ error: 'Error eliminando mensaje' });
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/chat/history (para historial)
// Obtener todas las conversaciones y mensajes (admin only)
// ──────────────────────────────────────────────────────────────────────────────
export const getChatHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.rol;

        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        // Solo JEFE y SUPERVISOR pueden ver todo el historial
        if (userRole !== 'JEFE' && userRole !== 'SUPERVISOR') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const prisma = await getPrisma();

        const conversations = await prisma.conversation.findMany({
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                nombre: true,
                                rol: true
                            }
                        }
                    }
                },
                messages: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                nombre: true,
                                rol: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 1000
        });

        res.json(conversations);
    } catch (error) {
        console.error('[Chat] Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error obteniendo historial' });
    }
};
