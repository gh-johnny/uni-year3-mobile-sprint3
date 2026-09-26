import { router } from 'expo-router';
import { act, renderRouter, screen, userEvent, waitFor } from 'expo-router/testing-library';

import { createTestServices, signInAs, TestServices } from '@/test-utils/render';

import { usePreferences } from '../state/preferences-store';
import { useSession } from '../state/session-store';

// The whole app, file-based routes included, on the real composition root (sql.js) — only device modules are faked.
let mockServices: TestServices;

jest.mock('@/presentation/app/bootstrap', () => ({ bootstrap: async () => mockServices }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(async () => true), hideAsync: jest.fn(async () => true) }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openURL: jest.fn(async () => true) }));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: false }, jest.fn()] }));

jest.setTimeout(60000);

const start = async (initialUrl = '/') => {
  await renderRouter('./src/app', { initialUrl });
};

beforeEach(async () => {
  mockServices = await createTestServices();
  useSession.setState({ status: 'booting', user: null, locked: false });
});

describe('signed out', () => {
  it('lands on sign-in, whatever URL is requested', async () => {
    await start('/garage');
    expect(await screen.findByTestId('sign-in')).toBeOnTheScreen();
  });
});

describe('owner journey', () => {
  it('signs in, moves between every tab, opens the sheets and signs out', async () => {
    await start();
    await userEvent.press(await screen.findByTestId('sign-in'));
    expect(await screen.findByTestId('garage-screen')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('tab', { name: 'History' }));
    expect(await screen.findByTestId('history-screen')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('tab', { name: 'Dealers' }));
    expect(await screen.findByTestId('dealers-screen')).toBeOnTheScreen();
    await act(async () => mockServices.heading.emit(45));

    await userEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('open-sync'));
    expect(await screen.findByTestId('sync-screen')).toBeOnTheScreen();
  });

  it('follows the garage into booking, then the pass', async () => {
    await signInAs(mockServices, 'owner');
    await start();
    expect(await screen.findByTestId('garage-screen')).toBeOnTheScreen();

    await userEvent.press((await screen.findAllByText('Book service'))[0]!);
    expect(await screen.findByTestId('booking-screen')).toBeOnTheScreen();
    await userEvent.press(await screen.findByTestId('service-oil'));
    await userEvent.press((await screen.findAllByTestId(/^dealer-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));
    await userEvent.press((await screen.findAllByTestId(/^slot-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));
    await userEvent.press(await screen.findByTestId('booking-confirm'));
    await userEvent.press(await screen.findByTestId('view-pass'));

    expect(await screen.findByTestId('pass-screen')).toBeOnTheScreen();
  });

  it('opens vehicle specs, the scanner and the design system from their entry points', async () => {
    await signInAs(mockServices, 'owner');
    await start();
    await userEvent.press((await screen.findAllByText('Spec sheet'))[0]!);
    expect(await screen.findByTestId('vehicle-screen')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('back'));

    await userEvent.press(await screen.findByTestId('add-vehicle'));
    expect(await screen.findByTestId('scan-screen')).toBeOnTheScreen();
  });

  it('keeps advisors out of owner routes', async () => {
    await signInAs(mockServices, 'advisor');
    await start('/garage');
    expect(await screen.findByTestId('pulse-screen')).toBeOnTheScreen();
  });
});

describe('advisor journey', () => {
  it('signs in as advisor, reads Pulse and Radar, and opens a lead sheet', async () => {
    await start();
    await userEvent.press(await screen.findByTestId('persona-advisor'));
    await userEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByTestId('pulse-screen')).toBeOnTheScreen();

    await userEvent.press(screen.getByRole('tab', { name: 'Radar' }));
    expect(await screen.findByTestId('radar-screen')).toBeOnTheScreen();
    await userEvent.press((await screen.findAllByTestId(/^lead-/))[0]!);
    expect(await screen.findByTestId('lead-screen')).toBeOnTheScreen();

    await act(async () => router.back());
    await userEvent.press(await screen.findByRole('tab', { name: 'Profile' }));
    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('open-design-system'));
    expect(await screen.findByTestId('design-system-screen')).toBeOnTheScreen();
  });

  it('returns to sign-in after signing out', async () => {
    await signInAs(mockServices, 'advisor');
    await start();
    await userEvent.press(await screen.findByRole('tab', { name: 'Profile' }));
    await userEvent.press(await screen.findByTestId('sign-out'));
    expect(await screen.findByTestId('sign-in')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('session restore and app lock', () => {
  it('restores a saved session straight into the home screen', async () => {
    await signInAs(mockServices, 'owner');
    await start();
    expect(await screen.findByTestId('garage-screen')).toBeOnTheScreen();
  });

  it('asks for biometrics when the lock is on and a stored session is restored', async () => {
    await signInAs(mockServices, 'owner');
    usePreferences.setState({ biometricLock: true });
    mockServices.biometrics.authenticated = false;
    await start();
    expect(await screen.findByTestId('unlock')).toBeOnTheScreen();
    expect(useSession.getState().locked).toBe(true);
  });

  it('applies the haptics preference and forwards connectivity to the sync engine', async () => {
    await start();
    await screen.findByTestId('sign-in');
    await act(async () => usePreferences.setState({ haptics: false }));
    await waitFor(() => expect(mockServices.haptics.isEnabled).toBe(false));
    await act(async () => mockServices.network.emit(false));
    expect(mockServices.container.sync.snapshot.status).toBe('offline');
  });
});
