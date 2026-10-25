import type { AttendanceLocation } from '../services/api';

// Request GPS only after the user chooses check-in/out. Never persist coordinates.
export function getAttendanceLocation(signal?: AbortSignal): Promise<AttendanceLocation> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is unavailable. Use a browser with GPS support on HTTPS or localhost.'));
      return;
    }
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    const finish = () => signal?.removeEventListener('abort', abort);
    navigator.geolocation.getCurrentPosition(position => {
      finish();
      if (signal?.aborted) return;
      const { latitude, longitude, accuracy } = position.coords;
      if (![latitude, longitude, accuracy].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) {
        reject(new Error('Could not read a valid GPS location. Please try again.'));
        return;
      }
      resolve({ latitude, longitude, accuracyMeters: accuracy });
    }, error => {
      finish();
      const messages: Record<number, string> = {
        1: 'Allow location access in your browser to record attendance.',
        2: 'Could not determine your location. Turn on location services and try again.',
        3: 'Location request timed out. Please try again.',
      };
      reject(new Error(messages[error.code] || 'Could not read a valid GPS location. Please try again.'));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
