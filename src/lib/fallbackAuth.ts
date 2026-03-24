import type { User, UserRole } from '../store/useMachineStore';

type FallbackCredential = {
  id: string;
  pin: string;
  user: User;
};

const fallbackCredentials: FallbackCredential[] = [
  {
    id: 'admin',
    pin: '4753',
    user: { id: 'admin', name: 'Administrador', role: 'JEFE' },
  },
  {
    id: 'Elkin Cavadia',
    pin: '11168',
    user: { id: 'Elkin Cavadia', name: 'Elkin Cavadia', role: 'JEFE' },
  },
  {
    id: 'Juan Alejandro',
    pin: '1111',
    user: { id: 'Juan Alejandro', name: 'Juan Alejandro', role: 'OPERARIO' },
  },
  {
    id: 'Juan Suaza',
    pin: '2222',
    user: { id: 'Juan Suaza', name: 'Juan Suaza', role: 'OPERARIO' },
  },
  {
    id: 'Ferney Tabares',
    pin: '3333',
    user: { id: 'Ferney Tabares', name: 'Ferney Tabares', role: 'OPERARIO' },
  },
  {
    id: 'turnero',
    pin: '4444',
    user: { id: 'turnero', name: 'Turnero', role: 'OPERARIO' },
  },
  {
    id: 'Jhon Piedrahita',
    pin: 'jp2026',
    user: { id: 'Jhon Piedrahita', name: 'Jhon Piedrahita', role: 'SUPERVISOR' },
  },
];

export function authenticateFallbackUser(id: string, pin: string): User | null {
  const match = fallbackCredentials.find((credential) => credential.id === id && credential.pin === pin);
  return match?.user || null;
}

export function canUseSupervisorPanel(role?: UserRole | null) {
  return role === 'JEFE' || role === 'SUPERVISOR';
}
