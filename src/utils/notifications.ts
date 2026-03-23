export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

export function scheduleHourlyNotifications() {
  // Clear any existing intervals if we were to store them, but for simplicity we'll just set a timeout
  // to the next hour, and then an interval.

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1);
  nextHour.setMinutes(0);
  nextHour.setSeconds(0);
  nextHour.setMilliseconds(0);

  const timeToNextHour = nextHour.getTime() - now.getTime();

  console.log(`Notificación programada en ${Math.round(timeToNextHour / 60000)} minutos.`);

  const showNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('AgriMonitor - Recorrido de Rutina', {
        body: 'Es momento de registrar los parámetros de las incubadoras y nacedoras.',
        icon: '/vite.svg' // Placeholder icon
      });
    }
  };

  // Schedule the first one at the top of the next hour
  setTimeout(() => {
    showNotification();
    
    // Then schedule every hour (3600000 ms)
    setInterval(showNotification, 3600000);
  }, timeToNextHour);
}
