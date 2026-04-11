import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Edit2, Check, X } from 'lucide-react';
import { getApiUrl, apiFetch } from '../lib/api';

interface User {
    id: string;
    nombre: string;
    rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE';
    turno: string;
    estado: string;
    ultimo_acceso?: string;
}

export default function UserManagementScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        nombre: string;
        pin: string;
        rol: 'OPERARIO' | 'SUPERVISOR' | 'JEFE';
        turno: string;
    }>({
        nombre: '',
        pin: '',
        rol: 'OPERARIO',
        turno: 'Turno 1'
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const res = await apiFetch(getApiUrl('/api/admin/users'));
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Error loading users:', err);
            setError('Error cargando usuarios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!formData.nombre.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        if (!formData.pin) {
            setError('El PIN es obligatorio');
            return;
        }

        try {
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId
                ? getApiUrl(`/api/admin/users/${editingId}`)
                : getApiUrl('/api/admin/users');

            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setSuccess(editingId ? 'Usuario actualizado' : 'Usuario creado exitosamente');
                setFormData({ nombre: '', pin: '', rol: 'OPERARIO', turno: 'Turno 1' });
                setEditingId(null);
                setShowForm(false);
                await loadUsers();
            } else {
                const data = await res.json();
                setError(data.error || 'Error en la operación');
            }
        } catch (err) {
            setError('Error procesando solicitud');
            console.error(err);
        }
    };

    const handleEdit = (user: User) => {
        setEditingId(user.id);
        setFormData({
            nombre: user.nombre,
            pin: '',
            rol: user.rol,
            turno: user.turno
        });
        setShowForm(true);
    };

    const handleDelete = async (userId: string, userName: string) => {
        if (!window.confirm(`¿Eliminar usuario ${userName}?`)) {
            return;
        }

        try {
            const res = await apiFetch(getApiUrl(`/api/admin/users/${userId}`), {
                method: 'DELETE'
            });

            if (res.ok) {
                setSuccess(`Usuario ${userName} eliminado`);
                await loadUsers();
            } else {
                const data = await res.json();
                setError(data.error);
            }
        } catch (err) {
            setError('Error eliminando usuario');
            console.error(err);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({ nombre: '', pin: '', rol: 'OPERARIO', turno: 'Turno 1' });
        setError(null);
    };

    const shifts = ['Turno 1', 'Turno 2', 'Turno 3', 'Gestión'];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Gestión de Usuarios</h1>
                    {!showForm && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                        >
                            <Plus size={20} />
                            Crear Usuario
                        </button>
                    )}
                </div>

                {/* Alerts */}
                {error && (
                    <div className="mb-4 p-4 bg-red-900/20 border border-red-500 text-red-300 rounded-lg">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 bg-green-900/20 border border-green-500 text-green-300 rounded-lg">
                        {success}
                    </div>
                )}

                {/* Form */}
                {showForm && (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
                        <h2 className="text-2xl font-bold text-white mb-4">
                            {editingId ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        placeholder="Ej: Juan Pérez"
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded"
                                    />
                                </div>

                                {/* PIN */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        PIN {editingId && '(dejar vacío para no cambiar)'}
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.pin}
                                        onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                        placeholder="Ej: 1234"
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded"
                                    />
                                </div>

                                {/* Rol */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Rol
                                    </label>
                                    <select
                                        value={formData.rol}
                                        onChange={e => setFormData({ ...formData, rol: e.target.value as any })}
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded"
                                    >
                                        <option>OPERARIO</option>
                                        <option>SUPERVISOR</option>
                                        <option>JEFE</option>
                                    </select>
                                </div>

                                {/* Turno */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Turno
                                    </label>
                                    <select
                                        value={formData.turno}
                                        onChange={e => setFormData({ ...formData, turno: e.target.value })}
                                        className="w-full bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded"
                                    >
                                        {shifts.map(t => (
                                            <option key={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Botones */}
                            <div className="flex gap-2 justify-end pt-4">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2"
                                >
                                    <Check size={18} />
                                    {editingId ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Users Table */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-400">Cargando usuarios...</div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Sin usuarios creados</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-700 border-b border-gray-600">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Nombre</th>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Rol</th>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Turno</th>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Estado</th>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Último Acceso</th>
                                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user, idx) => (
                                        <tr
                                            key={user.id}
                                            className={idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}
                                        >
                                            <td className="px-6 py-4 text-white">{user.nombre}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-sm font-medium ${user.rol === 'JEFE' ? 'bg-red-900 text-red-200' :
                                                    user.rol === 'SUPERVISOR' ? 'bg-yellow-900 text-yellow-200' :
                                                        'bg-blue-900 text-blue-200'
                                                    }`}>
                                                    {user.rol}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">{user.turno}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-sm ${user.estado === 'Activo'
                                                    ? 'bg-green-900 text-green-200'
                                                    : 'bg-gray-600 text-gray-300'
                                                    }`}>
                                                    {user.estado}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-400">
                                                {user.ultimo_acceso
                                                    ? new Date(user.ultimo_acceso).toLocaleString('es-CO')
                                                    : 'Nunca'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEdit(user)}
                                                        className="p-2 hover:bg-gray-700 rounded text-blue-400 hover:text-blue-300"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user.id, user.nombre)}
                                                        className="p-2 hover:bg-gray-700 rounded text-red-400 hover:text-red-300"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
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

                {/* Stats */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                        <div className="text-gray-400 text-sm">Total Usuarios</div>
                        <div className="text-3xl font-bold text-white">{users.length}</div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                        <div className="text-gray-400 text-sm">Operarios</div>
                        <div className="text-3xl font-bold text-blue-400">
                            {users.filter(u => u.rol === 'OPERARIO').length}
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                        <div className="text-gray-400 text-sm">Supervisores</div>
                        <div className="text-3xl font-bold text-yellow-400">
                            {users.filter(u => u.rol === 'SUPERVISOR').length}
                        </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                        <div className="text-gray-400 text-sm">Jefes</div>
                        <div className="text-3xl font-bold text-red-400">
                            {users.filter(u => u.rol === 'JEFE').length}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
