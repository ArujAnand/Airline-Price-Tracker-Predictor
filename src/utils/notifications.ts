import { playOptimalPriceChime, playPriceDropChime } from './audio';

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

export function sendBrowserPushNotification(
  title: string,
  options?: NotificationOptions & { isOptimalBuy?: boolean }
) {
  // Play sound
  if (options?.isOptimalBuy) {
    playOptimalPriceChime();
  } else {
    playPriceDropChime();
  }

  // Check Web Notification support
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (err) {
      console.warn('System notification trigger:', err);
    }
  }
}
