import { RunPoint } from "../state/types";

export type GeolocationCallback = (point: RunPoint) => void;
export type GeolocationErrorCallback = (error: GeolocationPositionError) => void;

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 15000,
};

/**
 * Thin wrapper around navigator.geolocation. Keeps the browser API
 * isolated so the rest of the app never touches it directly (easier to
 * mock in tests, easier to swap implementations later).
 */
export class GeolocationTracker {
  private watchId: number | null = null;

  isSupported(): boolean {
    return "geolocation" in navigator;
  }

  requestPermissionAndStart(
    onPoint: GeolocationCallback,
    onError: GeolocationErrorCallback
  ): void {
    if (!this.isSupported()) {
      onError({
        code: 2,
        message: "Geolocation not supported on this device/browser.",
      } as GeolocationPositionError);
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onPoint({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      onError,
      WATCH_OPTIONS
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  isActive(): boolean {
    return this.watchId !== null;
  }
}