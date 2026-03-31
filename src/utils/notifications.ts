export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.error('Error solicitando permisos de notificación:', e);
    return false;
  }
}

/**
 * Muestra una notificación de forma segura tanto en PC como en Móvil (PWA)
 */
export async function showAppNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    // Intento 1: Service Worker (Requerido en Android/Chrome móvil)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        await (registration as any).showNotification(title, {
          ...options,
          icon: options?.icon || '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
        });
        return;
      }
    }

    // Intento 2: Constructor estándar (Solo funciona en Desktop)
    new Notification(title, options);
  } catch (e) {
    console.warn('Fallo al mostrar notificación nativa, usando fallback...');
    // Fallback silencioso o log
  }
}

export function scheduleHourlyNotifications() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  nextHour.setMilliseconds(0);

  const timeToNextHour = nextHour.getTime() - now.getTime();

  const trigger = () => {
    showAppNotification('Incubant - Recorrido de Rutina', {
      body: 'Es momento de registrar los parámetros de las incubadoras y nacedoras.',
    });
  };

  setTimeout(() => {
    trigger();
    setInterval(trigger, 3600000);
  }, timeToNextHour);
}
