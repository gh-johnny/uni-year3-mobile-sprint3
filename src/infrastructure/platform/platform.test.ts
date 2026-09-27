import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as Network from 'expo-network';

import { BiometricService } from './biometrics';
import { HapticsService } from './haptics';
import { ExpoLocationProvider } from './location';
import { NetworkMonitor } from './network';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchHeadingAsync: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

const location = jest.mocked(Location);
const haptics = jest.mocked(Haptics);
const auth = jest.mocked(LocalAuthentication);
const network = jest.mocked(Network);
const fix = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } }) as Location.LocationObject;

describe('ExpoLocationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    location.getForegroundPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
  });

  it('returns null when permission is denied', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    expect(await new ExpoLocationProvider().current()).toBeNull();
  });

  it('prefers the last known position', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue(fix(-23.5, -46.6));
    expect((await new ExpoLocationProvider().current())?.latitude).toBe(-23.5);
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('asks for a fresh fix, with a timeout', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    location.getLastKnownPositionAsync.mockResolvedValue(null);
    location.getCurrentPositionAsync.mockResolvedValue(fix(-23.6, -46.7));
    expect((await new ExpoLocationProvider().current())?.longitude).toBe(-46.7);

    location.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
    expect(await new ExpoLocationProvider(5).current()).toBeNull();
  });

  it('swallows native errors', async () => {
    location.requestForegroundPermissionsAsync.mockRejectedValue(new Error('no GPS'));
    expect(await new ExpoLocationProvider().current()).toBeNull();
  });

  it('streams the heading, falling back to the magnetic one', async () => {
    const remove = jest.fn();
    location.watchHeadingAsync.mockImplementation(async (callback) => {
      callback({ trueHeading: 90, magHeading: 80, accuracy: 3 });
      callback({ trueHeading: -1, magHeading: 80, accuracy: 3 });
      return { remove };
    });
    const listener = jest.fn();
    const stop = await new ExpoLocationProvider().watch(listener);
    expect(listener.mock.calls).toEqual([[90], [80]]);
    stop();
    expect(remove).toHaveBeenCalled();

    location.watchHeadingAsync.mockRejectedValue(new Error('no compass'));
    const noop = await new ExpoLocationProvider().watch(listener);
    expect(noop()).toBeUndefined();
  });
});

describe('HapticsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps semantic feedback to native haptics', async () => {
    const service = new HapticsService();
    service.tap();
    service.select();
    service.commit();
    service.success();
    service.warning();
    service.error();
    expect(haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(haptics.impactAsync).toHaveBeenCalledWith('heavy');
    expect(haptics.selectionAsync).toHaveBeenCalled();
    expect(haptics.notificationAsync.mock.calls).toEqual([['success'], ['warning'], ['error']]);
  });

  it('plays the heartbeat pattern and can be disabled', async () => {
    jest.useFakeTimers();
    const service = new HapticsService();
    service.heartbeat();
    await Promise.resolve();
    jest.advanceTimersByTime(200);
    jest.useRealTimers();
    await new Promise((resolve) => setImmediate(resolve));
    expect(haptics.impactAsync.mock.calls).toEqual([['medium'], ['light']]);

    service.setEnabled(false);
    expect(service.isEnabled).toBe(false);
    service.tap();
    expect(haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('ignores native failures', async () => {
    haptics.selectionAsync.mockRejectedValueOnce(new Error('unsupported'));
    expect(() => new HapticsService().select()).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});

describe('BiometricService', () => {
  it('reports availability', async () => {
    const service = new BiometricService();
    auth.hasHardwareAsync.mockResolvedValue(false);
    expect(await service.availability()).toBe('unsupported');
    auth.hasHardwareAsync.mockResolvedValue(true);
    auth.isEnrolledAsync.mockResolvedValue(false);
    expect(await service.availability()).toBe('notEnrolled');
    auth.isEnrolledAsync.mockResolvedValue(true);
    expect(await service.availability()).toBe('available');
    auth.hasHardwareAsync.mockRejectedValue(new Error('x'));
    expect(await service.availability()).toBe('unsupported');
  });

  it('authenticates', async () => {
    const service = new BiometricService();
    auth.authenticateAsync.mockResolvedValue({ success: true } as never);
    expect(await service.authenticate('Unlock', 'Cancel')).toBe(true);
    expect(auth.authenticateAsync).toHaveBeenCalledWith({ promptMessage: 'Unlock', cancelLabel: 'Cancel', disableDeviceFallback: false });
    auth.authenticateAsync.mockRejectedValue(new Error('x'));
    expect(await service.authenticate('Unlock', 'Cancel')).toBe(false);
  });
});

describe('NetworkMonitor', () => {
  it('reads and streams connectivity', async () => {
    const monitor = new NetworkMonitor();
    network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
    expect(await monitor.isOnline()).toBe(true);
    network.getNetworkStateAsync.mockResolvedValue({ isConnected: true, isInternetReachable: false } as never);
    expect(await monitor.isOnline()).toBe(false);
    network.getNetworkStateAsync.mockRejectedValue(new Error('x'));
    expect(await monitor.isOnline()).toBe(true);

    const remove = jest.fn();
    network.addNetworkStateListener.mockImplementation((listener) => {
      listener({ isConnected: false } as never);
      return { remove } as never;
    });
    const listener = jest.fn();
    const stop = monitor.subscribe(listener);
    expect(listener).toHaveBeenCalledWith(false);
    stop();
    expect(remove).toHaveBeenCalled();
  });
});
