import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Plus, Check, X } from 'lucide-react';
import { getApiUrl, apiFetch } from '../lib/api';
import { useMachineStore } from '../store/useMachineStore';

interface Conversation {
    id: string;
    titulo?: string;
    tipo: 'PRIVADO' | 'REPORTES' | 'GENERAL' | 'TURNO';
    participants: Array<{
        user: {
            id: string;
            nombre: string;
            rol: string;
            turno: string;
        };
    }>;
    messages: Array<{
        id: string;
        contenido: string;
        createdAt: string;
        sender: {
            id: string;
            nombre: string;
            rol: string;
        };
    }>;
    createdAt: string;
    updatedAt: string;
}

interface Message {
    id: string;
    contenido: string;
    createdAt: string;
    sender: {
        id: string;
        nombre: string;
        rol: string;
    };
}

export default function ChatPanel() {
    const currentUser = useMachineStore(state => state.currentUser);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showNewChat, setShowNewChat] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cargar conversaciones
    useEffect(() => {
        loadConversations();
        const interval = setInterval(loadConversations, 5000); // Actualizar cada 5s
        return () => clearInterval(interval);
    }, []);

    // Cargar mensajes cuando se selecciona conversación
    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation.id);
            const interval = setInterval(() => loadMessages(selectedConversation.id), 3000);
            return () => clearInterval(interval);
        }
    }, [selectedConversation]);

    const loadConversations = async () => {
        try {
            const res = await apiFetch(getApiUrl('/api/chat/conversations'));
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
                setIsLoading(false);
            }
        } catch (err) {
            console.error('Error cargando conversaciones:', err);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const res = await apiFetch(getApiUrl(`/api/chat/conversations/${conversationId}/messages?limit=100`));
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Error cargando mensajes:', err);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const res = await apiFetch(getApiUrl('/api/chat/messages'), {
                method: 'POST',
                body: JSON.stringify({
                    conversation_id: selectedConversation.id,
                    contenido: newMessage
                })
            });

            if (res.ok) {
                setNewMessage('');
                await loadMessages(selectedConversation.id);
            }
        } catch (err) {
            console.error('Error enviando mensaje:', err);
        }
    };

    const otherParticipants = selectedConversation?.participants
        .filter(p => p.user.id !== currentUser?.id)
        .map(p => p.user.nombre)
        .join(', ') || '';

    return (
        <div className="flex h-full bg-gray-900 text-white rounded-lg overflow-hidden">
            {/* Lista de conversaciones */}
            <div className="w-80 border-r border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle size={20} className="text-blue-400" />
                        <h2 className="font-bold">Mensajes</h2>
                    </div>
                    <button
                        onClick={() => setShowNewChat(!showNewChat)}
                        className="p-1 hover:bg-gray-800 rounded"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500">Cargando...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">Sin conversaciones</div>
                    ) : (
                        conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => setSelectedConversation(conv)}
                                className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800 transition ${selectedConversation?.id === conv.id ? 'bg-gray-800' : ''
                                    }`}
                            >
                                <div className="font-sm font-semibold truncate">
                                    {conv.titulo || conv.participants
                                        .filter(p => p.user.id !== currentUser?.id)
                                        .map(p => p.user.nombre)
                                        .join(', ')}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {conv.messages[0]?.contenido || 'Sin mensajes'}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Panel de mensajes */}
            <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-gray-800">
                            <h3 className="font-bold">{selectedConversation.titulo || otherParticipants}</h3>
                            <p className="text-xs text-gray-400">{selectedConversation.tipo}</p>
                        </div>

                        {/* Mensajes */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender.id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs px-3 py-2 rounded-lg ${msg.sender.id === currentUser?.id
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-100'
                                            }`}
                                    >
                                        {msg.sender.id !== currentUser?.id && (
                                            <p className="text-xs font-semibold text-gray-300">{msg.sender.nombre}</p>
                                        )}
                                        <p className="text-sm break-words">{msg.contenido}</p>
                                        <p className="text-xs opacity-70 mt-1">
                                            {new Date(msg.createdAt).toLocaleTimeString('es-CO', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-700 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!newMessage.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 p-2 rounded"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Selecciona una conversación para empezar
                    </div>
                )}
            </div>
        </div>
    );
}
