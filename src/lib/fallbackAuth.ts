import type { User, UserRole } from '../store/useMachineStore';

import type { UserRole } from '../store/useMachineStore';

export function canUseSupervisorPanel(role?: UserRole | null) {
  return role === 'JEFE' || role === 'SUPERVISOR';
}
