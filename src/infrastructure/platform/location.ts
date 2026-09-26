import * as Location from 'expo-location';

import { LocationProvider } from '@/application/ports/services';
import { GeoPoint } from '@/domain/geo/geo-point';

export interface HeadingSource {
  /** Emits the device heading (degrees from true north). Returns an unsubscribe function. */
  watch(listener: (degrees: number) => void): Promise<() => void>;
}

/** GPS fix with graceful degradation: permission denied or timeout → `null`. */
export class ExpoLocationProvider implements LocationProvider, HeadingSource {
  constructor(private readonly timeoutMs = 4_000) {}

  async current(): Promise<GeoPoint | null> {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return null;
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      const fix =
        lastKnown ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), this.timeoutMs)),
        ]));
      return fix ? GeoPoint.restore(fix.coords.latitude, fix.coords.longitude) : null;
    } catch {
      return null;
    }
  }

  async watch(listener: (degrees: number) => void): Promise<() => void> {
    try {
      const subscription = await Location.watchHeadingAsync((heading) => {
        listener(heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading);
      });
      return () => subscription.remove();
    } catch {
      return () => undefined;
    }
  }
}
