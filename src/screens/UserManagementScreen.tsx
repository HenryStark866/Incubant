import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, Check, X, Users, Shield, HardHat, UserCog, RefreshCw, Loader2 } from 'lucide-react';
import { getApiUrl, apiFetch } from '../lib/api';
import { useThemeStore } from '../store/useThemeStore';

interface User {
    id: string;
    nombre: string;
    rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE';
    turno: string;
    estado: string;
    pin?: string;
    ultimo_acceso?: string;
}

const SHIFTS = ['Turno 1', 'Turno 2', 'Turno 3', 'Gestión'];

const RoleBadge = ({ rol }: { rol: string }) => {
    const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
        JEFE:       { label: 'Jefe',       cls: 'bg-red-500/10 text-red-400 border-red-500/20',       icon: <Shield size={11} /> },
        SUPERVISOR: { label: 'Supervisor', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <UserCog size={11} /> },
        OPERARIO:   { label: 'Operario',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',     icon: <HardHat size={11} /> },
    };
    const v = map[rol] ?? { label: rol, cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: null };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${v.cls}`}>
            {v.icon}{v.label}
        </span>
    );
};

export default function UserManagementScreen() {
    const theme = useThemeStore(state => state.theme);
    const isDark = theme === 'dark';

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        nombre: string;
        pin: string;
        rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE';
        turno: string;
        estado: string;
    }>({
        nombre: '',
        pin: '',
        rol: 'OPERARIO',
        turno: 'Turno 1',
        estado: 'ACTIVO',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        void loadUsers();

        // Polling cada 5s para mantener la lista sincronizada
        const pollInterval = setInterval(() => void loadUsers(true), 5000);

        // SSE: recarga inmediata al recibir cualquier evento del backend
        let es: EventSource | null = null;
        try {
            es = new EventSource(getApiUrl('/api/events'));
            es.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    // Recarga en eventos relevantes (no en ping)
                    if (data.type && data.type !== 'ping') {
                        void loadUsers(true);
                    }
                } catch { /* ignorar mensajes malformados */ }
            };
            es.onerror = () => { es?.close(); };
        } catch { /* SSE no disponible en este entorno */ }

        return () => {
            clearInterval(pollInterval);
            es?.close();
        };
    }, []);

    // Auto-clear alerts
    useEffect(() => {
        if (!success && !error) return;
        const t = setTimeout(() => { setSuccess(null); setError(null); }, 4000);
        return () => clearTimeout(t);
    }, [success, error]);

    const loadUsers = async (quiet = false) => {
        if (!quiet) setIsLoading(true);
        else setIsRefreshing(true);
        try {
            const res = await apiFetch(getApiUrl('/api/admin/users'));
            if (res.ok) {
                const data = await res.json();
                setUsers(Array.isArray(data) ? data : []);
            } else {
                setError('Error cargando usuarios del servidor');
            }
        } catch (err) {
            console.error('Error loading users:', err);
            setError('Error de conexión con el servidor');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!formData.nombre.trim()) { setError('El nombre es obligatorio'); return; }
        if (!editingId && (!formData.pin || !/^\d{4}$/.test(formData.pin))) {
            setError('El PIN debe ser exactamente 4 dígitos numéricos');
            return;
        }
        if (formData.pin && !/^\d{4}$/.test(formData.pin)) {
            setError('El PIN debe ser exactamente 4 dígitos numéricos');
            return;
        }

        setIsSaving(true);
        try {
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId
                ? getApiUrl(`/api/admin/users/${editingId}`)
                : getApiUrl('/api/admin/users');

            // Si no se cambió el pin al editar, no lo enviamos
            const payload: any = { nombre: formData.nombre, rol: formData.rol, turno: formData.turno, estado: formData.estado };
            if (formData.pin) payload.pin = formData.pin;

            const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
            if (res.ok) {
                setSuccess(editingId ? 'Usuario actualizado correctamente' : 'Usuario creado exitosamente');
                resetForm();
                await loadUsers(true);
            } else {
                const data = await res.json();
                setError(data.error || 'Error en la operación');
            }
        } catch (err) {
            setError('Error procesando solicitud');
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (user: User) => {
        setEditingId(user.id);
        setFormData({ nombre: user.nombre, pin: '', rol: user.rol, turno: user.turno, estado: user.estado || 'ACTIVO' });
        setShowForm(true);
        setError(null);
        setSuccess(null);
    };

    const handleDelete = async (userId: string, userName: string) => {
        if (!window.confirm(`¿Eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await apiFetch(getApiUrl(`/api/admin/users/${userId}`), { method: 'DELETE' });
            if (res.ok) {
                setSuccess(`Usuario "${userName}" eliminado`);
                await loadUsers(true);
            } else {
                const data = await res.json();
                setError(data.error || 'Error eliminando usuario');
            }
        } catch {
            setError('Error de conexión al eliminar usuario');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nombre: '', pin: '', rol: 'OPERARIO', turno: 'Turno 1', estado: 'ACTIVO' });
        setError(null);
    };

    const card = isDark ? 'bg-[#0a0f20] border-white/5' : 'bg-white border-gray-100';
    const inputCls = `w-full px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all outline-none focus:ring-0 ${
        isDark
            ? 'bg-white/5 border-white/10 text-white focus:border-brand-primary placeholder:text-white/20'
            : 'bg-gray-50 border-gray-200 text-brand-dark focus:border-brand-primary placeholder:text-gray-400'
    }`;
    const labelCls = `block text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? 'text-white/40' : 'text-brand-gray'}`;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-brand-primary rounded-full" />
                    <div>
                        <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>Personal de Planta</h2>
                        <p className={`text-xs font-medium ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>
                            {users.length} usuario{users.length !== 1 ? 's' : ''} registrados
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => void loadUsers(true)}
                        disabled={isRefreshing}
                        className={`p-2 rounded-xl transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-gray-100 hover:bg-gray-200 text-brand-gray'}`}
                        title="Actualizar lista"
                    >
                        <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    {!showForm && (
                        <button
                            onClick={() => { setShowForm(true); setEditingId(null); setError(null); }}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white px-4 py-2 rounded-xl text-sm font-black transition-all shadow-lg shadow-brand-primary/20 active:scale-95"
                        >
                            <Plus size={16} />
                            Nuevo Usuario
                        </button>
                    )}
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2 duration-200">
                    <X size={16} className="flex-shrink-0" />{error}
                </div>
            )}
            {success && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2 duration-200">
                    <Check size={16} className="flex-shrink-0" />{success}
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div className={`rounded-3xl border p-6 shadow-sm ${card} animate-in slide-in-from-top-4 duration-300`}>
                    <div className="flex items-center justify-between mb-5">
                        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-brand-dark'}`}>
                            {editingId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
                        </h3>
                        <button onClick={resetForm} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-gray-100 text-brand-gray'}`}>
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className={labelCls}>Nombre Completo</label>
                            <input type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Juan Pérez" className={inputCls} required />
                        </div>
                        <div>
                            <label className={labelCls}>PIN {editingId ? '(vacío = sin cambios)' : '(4 dígitos)'}</label>
                            <input type="password" value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                maxLength={4} placeholder="••••" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Rol</label>
                            <select value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value as any })} className={inputCls}>
                                <option value="OPERARIO">Operario</option>
                                <option value="SUPERVISOR">Supervisor</option>
                                <option value="JEFE">Jefe / Administrador</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Turno</label>
                            <select value={formData.turno} onChange={e => setFormData({ ...formData, turno: e.target.value })} className={inputCls}>
                                {SHIFTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        {editingId && (
                            <div>
                                <label className={labelCls}>Estado</label>
                                <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })} className={inputCls}>
                                    <option value="ACTIVO">Activo</option>
                                    <option value="INACTIVO">Inactivo</option>
                                </select>
                            </div>
                        )}
                        <div className={`flex items-end gap-2 ${editingId ? '' : 'sm:col-span-2 lg:col-span-4 lg:justify-end'}`}>
                            <button type="button" onClick={resetForm} className={`px-5 py-2.5 rounded-xl border-2 text-sm font-black transition-all ${isDark ? 'border-white/10 text-white/50 hover:bg-white/5' : 'border-gray-200 text-brand-gray hover:bg-gray-50'}`}>
                                Cancelar
                            </button>
                            <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-black shadow-lg shadow-brand-primary/20 hover:bg-brand-secondary disabled:opacity-50 transition-all active:scale-95">
                                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                {isSaving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear Usuario')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', count: users.length, color: 'text-brand-primary', icon: <Users size={18} /> },
                    { label: 'Operarios', count: users.filter(u => u.rol === 'OPERARIO').length, color: 'text-blue-400', icon: <HardHat size={18} /> },
                    { label: 'Supervisores', count: users.filter(u => u.rol === 'SUPERVISOR').length, color: 'text-yellow-400', icon: <UserCog size={18} /> },
                    { label: 'Jefes', count: users.filter(u => u.rol === 'JEFE').length, color: 'text-red-400', icon: <Shield size={18} /> },
                ].map(stat => (
                    <div key={stat.label} className={`rounded-2xl border p-4 ${card}`}>
                        <div className={`flex items-center gap-2 mb-2 ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>
                            {stat.icon}
                            <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className={`text-3xl font-black leading-none ${stat.color}`}>{stat.count}</p>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div className={`rounded-3xl border overflow-hidden shadow-sm ${card}`}>
                {isLoading ? (
                    <div className="flex items-center justify-center gap-3 py-16">
                        <Loader2 size={24} className="text-brand-primary animate-spin" />
                        <span className={`text-sm font-bold ${isDark ? 'text-white/40' : 'text-brand-gray'}`}>Cargando usuarios...</span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Users size={40} className={isDark ? 'text-white/10' : 'text-gray-200'} />
                        <p className={`text-sm font-bold ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>Sin usuarios registrados</p>
                        <button onClick={() => setShowForm(true)} className="text-brand-primary text-sm font-black hover:underline">
                            + Crear el primer usuario
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className={`border-b ${isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-50 bg-gray-50/50'}`}>
                                    {['Nombre', 'Rol', 'Turno', 'Estado', 'Acciones'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-brand-gray'}`}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user, idx) => (
                                    <tr key={user.id} className={`border-b transition-colors ${
                                        isDark
                                            ? `${idx % 2 === 0 ? '' : 'bg-white/[0.02]'} border-white/5 hover:bg-white/5`
                                            : `${idx % 2 === 0 ? '' : 'bg-gray-50/30'} border-gray-50 hover:bg-brand-primary/5`
                                    }`}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                                    user.rol === 'JEFE' ? 'bg-red-500/10 text-red-400'
                                                    : user.rol === 'SUPERVISOR' ? 'bg-yellow-500/10 text-yellow-400'
                                                    : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                    {user.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-brand-dark'}`}>{user.nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5"><RoleBadge rol={user.rol} /></td>
                                        <td className={`px-5 py-3.5 text-sm font-medium ${isDark ? 'text-white/50' : 'text-brand-gray'}`}>{user.turno || '—'}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${
                                                (user.estado === 'ACTIVO' || user.estado === 'Activo')
                                                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${(user.estado === 'ACTIVO' || user.estado === 'Activo') ? 'bg-green-400' : 'bg-gray-400'}`} />
                                                {user.estado}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-white/30 hover:text-blue-400' : 'hover:bg-blue-50 text-gray-400 hover:text-blue-500'}`}
                                                    title="Editar usuario"
                                                >
                                                    <Edit2 size={15} />
                                                </button>
                                                <button
                                                    onClick={() => void handleDelete(user.id, user.nombre)}
                                                    className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-red-500/10 text-white/30 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'}`}
                                                    title="Eliminar usuario"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
