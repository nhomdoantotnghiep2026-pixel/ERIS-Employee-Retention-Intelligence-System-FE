import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('attendance requests a fresh high accuracy browser position and never substitutes a location', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    const { getAttendanceLocation } = await server.ssrLoadModule('/src/utils/attendanceLocation.ts');
    let options: PositionOptions | undefined;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition(success: PositionCallback, _failure: PositionErrorCallback, supplied: PositionOptions) {
        options = supplied;
        success({ coords: { latitude: 10.8, longitude: 106.7, accuracy: 23 } } as GeolocationPosition);
      },
    } } });
    assert.deepEqual(await getAttendanceLocation(), { latitude: 10.8, longitude: 106.7, accuracyMeters: 23 });
    assert.deepEqual(options, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    for (const code of [1, 2, 3]) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
        getCurrentPosition(_success: PositionCallback, failure: PositionErrorCallback) { failure({ code } as GeolocationPositionError); },
      } } });
      await assert.rejects(getAttendanceLocation(), (error: Error) => error.message.length > 0);
    }
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition(success: PositionCallback) {
        success({ coords: { latitude: NaN, longitude: 106.7, accuracy: 20 } } as GeolocationPosition);
      },
    } } });
    await assert.rejects(getAttendanceLocation(), /valid GPS/);
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition() { /* Simulate a pending permission prompt. */ },
    } } });
    const pending = new AbortController();
    const pendingLocation = getAttendanceLocation(pending.signal);
    pending.abort();
    await assert.rejects(pendingLocation, (error: Error) => error.name === 'AbortError');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    await assert.rejects(getAttendanceLocation(), /location/i);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(getAttendanceLocation(abort.signal), (error: Error) => error.name === 'AbortError');
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else Reflect.deleteProperty(globalThis, 'navigator');
    await server.close();
  }
});
