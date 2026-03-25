import { useEffect, useState } from 'react';
import { getApiUrl } from '../lib/api';

export type RealTimeEvent = {
  type: 'NEW_ASSIGNMENT' | 'SHIFT_REMINDER' | 'LOGIN_REMINDER' | 'SHIFT_UPDATE' | 'ALARM_ALERT';
  title?: string;
  message: string;
  targetUserId?: string;
  assignment?: any;
};

export function useEvents(userId?: string) {
  const [lastEvent, setLastEvent] = useState<RealTimeEvent | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(getApiUrl('/api/events'));

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealTimeEvent;
        
        // Si el evento tiene un destinatario específico y no somos nosotros, ignorar
        if (data.targetUserId && data.targetUserId !== userId) {
          return;
        }

        setLastEvent(data);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [userId]);

  return { lastEvent };
}
