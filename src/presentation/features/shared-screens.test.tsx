import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Result } from '@/domain/shared/result';
import { createTestServices, renderWithServices, signInAs, TestServices } from '@/test-utils/render';
import { resetRouter, routerSpy } from '@/test-utils/router-mock';

import { usePreferences } from '../state/preferences-store';
import { useSession } from '../state/session-store';
import { useToasts } from '../state/toast-store';
import { SignInScreen } from './auth/sign-in-screen';
import { DesignSystemScreen } from './showcase/design-system-screen';
import { SettingsScreen } from './settings/settings-screen';
import { SyncPill } from './sync/sync-pill';
import { SyncScreen } from './sync/sync-screen';

jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock);

jest.setTimeout(30000);

const toasts = () => useToasts.getState().toasts.map((toast) => toast.title);

let services: TestServices;

beforeEach(async () => {
  resetRouter();
  services = await createTestServices();
});

describe('SettingsScreen', () => {
  it('shows the owner profile and applies appearance preferences immediately', async () => {
    await signInAs(services, 'owner');
    await renderWithServices(<SettingsScreen />, services);

    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Ana Ribeiro');
    expect(screen.getByText('Ford owner')).toBeOnTheScreen();

    await userEvent.press(within(screen.getByTestId('theme-control')).getByText('Dark'));
    expect(usePreferences.getState().theme).toBe('dark');
    await userEvent.press(within(screen.getByTestId('language-control')).getByText('Português'));
    expect(usePreferences.getState().locale).toBe('pt-BR');
    expect(await screen.findByText('Aparência')).toBeOnTheScreen();
  });

  it('toggles haptics, and biometrics only after the device confirms it', async () => {
    await signInAs(services, 'owner');
    await renderWithServices(<SettingsScreen />, services);
    await screen.findByTestId('profile-name');

    await userEvent.press(screen.getByTestId('haptics-switch'));
    expect(usePreferences.getState().haptics).toBe(false);

    services.biometrics.authenticated = false;
    await userEvent.press(screen.getByTestId('biometric-switch'));
    expect(usePreferences.getState().biometricLock).toBe(false);
    services.biometrics.authenticated = true;
    await userEvent.press(screen.getByTestId('biometric-switch'));
    await waitFor(() => expect(usePreferences.getState().biometricLock).toBe(true));
    await userEvent.press(screen.getByTestId('biometric-switch'));
    await waitFor(() => expect(usePreferences.getState().biometricLock).toBe(false));
  });

  it('explains when biometrics are unavailable', async () => {
    services.biometrics.available = 'unsupported';
    await signInAs(services, 'owner');
    await renderWithServices(<SettingsScreen />, services);
    expect(await screen.findByText('Biometrics not available on this device')).toBeOnTheScreen();
    expect(screen.getByTestId('biometric-switch')).toBeDisabled();
  });

  it('names the advisor dealership', async () => {
    await signInAs(services, 'advisor');
    await renderWithServices(<SettingsScreen />, services);
    expect(await screen.findByText('Service advisor · Ford Pinheiros')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-name')).toHaveTextContent(/Carlos/);
  });

  it('opens the sync center and the design system, and resets demo data after confirming', async () => {
    const user = await signInAs(services, 'owner');
    await renderWithServices(<SettingsScreen />, services);
    await screen.findByTestId('profile-name');

    await userEvent.press(screen.getByTestId('open-sync'));
    expect(routerSpy.push).toHaveBeenLastCalledWith('/sync');
    await userEvent.press(screen.getByTestId('open-design-system'));
    expect(routerSpy.push).toHaveBeenLastCalledWith('/design-system');

    const garage = (await services.container.useCases.getGarage.execute(user)).value;
    const nearby = (await services.container.useCases.listDealersNearby.execute(user)).value;
    const dealerId = nearby.dealers[0]!.dealer.id;
    const slots = (await services.container.useCases.getAvailability.execute({ dealerId, serviceType: 'oil', day: new Date('2026-09-29T12:00:00Z') })).value;
    await services.container.useCases.bookAppointment.execute(user, { vehicleId: garage.vehicles[0]!.vehicle.id, dealerId, serviceType: 'oil', start: slots[0]!.slot.start });
    expect(await services.container.useCases.repositories.outbox.pendingCount()).toBeGreaterThan(0);

    await userEvent.press(screen.getByTestId('reset-demo'));
    expect(screen.getByText('Reset demo data?')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(toasts()).not.toContain('Demo data regenerated');

    await userEvent.press(screen.getByTestId('reset-demo'));
    await userEvent.press(screen.getAllByRole('button', { name: 'Reset demo data' }).at(-1)!);
    await waitFor(() => expect(toasts()).toContain('Demo data regenerated'));
    expect(await services.container.useCases.repositories.outbox.pendingCount()).toBe(0);
  });

  it('signs out through the use case and clears the session', async () => {
    await signInAs(services, 'owner');
    const signOut = jest.spyOn(services.container.useCases.signOut, 'execute');
    // Stands in for the router's `Stack.Protected`, which unmounts guarded screens on sign-out.
    const Guard = () => (useSession((state) => state.status) === 'signedIn' ? <SettingsScreen /> : <Text>signed out</Text>);
    await renderWithServices(<Guard />, services);
    await userEvent.press(await screen.findByTestId('sign-out'));
    expect(await screen.findByText('signed out')).toBeOnTheScreen();
    expect(useSession.getState().user).toBeNull();
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('SyncScreen and SyncPill', () => {
  const book = async () => {
    const user = await signInAs(services, 'owner');
    const garage = (await services.container.useCases.getGarage.execute(user)).value;
    const nearby = (await services.container.useCases.listDealersNearby.execute(user)).value;
    const dealerId = nearby.dealers[0]!.dealer.id;
    const slots = (await services.container.useCases.getAvailability.execute({ dealerId, serviceType: 'oil', day: new Date('2026-09-29T12:00:00Z') })).value;
    return services.container.useCases.bookAppointment.execute(user, { vehicleId: garage.vehicles[0]!.vehicle.id, dealerId, serviceType: 'oil', start: slots[0]!.slot.start });
  };

  it('shows what waits in the outbox and drains it on demand', async () => {
    await book();
    await services.container.sync.refreshPending();
    await renderWithServices(<SyncScreen />, services);

    expect(await screen.findByText('1 change waiting')).toBeOnTheScreen();
    expect(screen.getByText('Never synced')).toBeOnTheScreen();
    expect(screen.getByText('Pending')).toBeOnTheScreen();
    expect(screen.getByText(/Gateway:/)).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('sync-now'));
    expect(await screen.findByText('0 changes waiting')).toBeOnTheScreen();
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Up to date');
    expect(await screen.findByText('Sent')).toBeOnTheScreen();
    expect(screen.getByText(/Last sync/)).toBeOnTheScreen();
  });

  it('reflects offline and retrying states, and an empty outbox', async () => {
    await signInAs(services, 'owner');
    await renderWithServices(<SyncScreen />, services);
    expect(await screen.findByTestId('sync-status')).toHaveTextContent('Up to date');

    await act(async () => services.container.sync.setOnline(false));
    await waitFor(() => expect(screen.getByTestId('sync-status')).toHaveTextContent('Offline — changes are safe on this device'));
  });

  it('shows the retry state when the gateway keeps failing', async () => {
    const failing = await createTestServices({ failureRate: 1 });
    await signInAs(failing, 'owner');
    const user = useSession.getState().user!;
    const nearby = (await failing.container.useCases.listDealersNearby.execute(user)).value;
    const garage = (await failing.container.useCases.getGarage.execute(user)).value;
    const slots = (await failing.container.useCases.getAvailability.execute({ dealerId: nearby.dealers[0]!.dealer.id, serviceType: 'oil', day: new Date('2026-09-29T12:00:00Z') })).value;
    await failing.container.useCases.bookAppointment.execute(user, { vehicleId: garage.vehicles[0]!.vehicle.id, dealerId: nearby.dealers[0]!.dealer.id, serviceType: 'oil', start: slots[0]!.slot.start });

    await renderWithServices(<SyncScreen />, failing);
    await userEvent.press(await screen.findByTestId('sync-now'));
    expect(await screen.findByText('Retrying with backoff')).toBeOnTheScreen();
    expect(screen.getByText('1 attempt')).toBeOnTheScreen();
  });

  it('the pill shows pending changes and opens the sync center', async () => {
    await book();
    await services.container.sync.refreshPending();
    await renderWithServices(<SyncPill />, services);
    const pill = await screen.findByTestId('sync-pill');
    await waitFor(() => expect(pill).toHaveTextContent('1'));
    await userEvent.press(pill);
    expect(routerSpy.push).toHaveBeenCalledWith('/sync');
  });
});

describe('DesignSystemScreen', () => {
  it('lists every token group and component family, and goes back', async () => {
    await signInAs(services, 'owner');
    await renderWithServices(<DesignSystemScreen />, services);
    for (const title of ['Design system', 'Colour tokens', 'Typography', 'Buttons', 'Badges & chips', 'Inputs', 'Data display']) {
      expect((await screen.findAllByText(new RegExp(`^${title}$`, 'i'))).length).toBeGreaterThan(0);
    }
    await userEvent.press(screen.getByRole('switch', { name: 'Switch' }));
    await userEvent.press(screen.getByText('Chip 2'));
    await userEvent.press(screen.getByTestId('back'));
    expect(routerSpy.back).toHaveBeenCalled();
  });
});

describe('SignInScreen', () => {
  it('signs the owner in with the pre-filled demo account', async () => {
    await renderWithServices(<SignInScreen />, services);
    expect(screen.getByText(/Keep\s+moving\./)).toBeOnTheScreen();
    expect(screen.getByLabelText('E-mail').props.value).toBe('ana@pitlane.app');

    await userEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(useSession.getState().status).toBe('signedIn'));
    expect(useSession.getState().user?.role.key).toBe('owner');
  });

  it('switches persona, filling that persona\'s demo credentials', async () => {
    await renderWithServices(<SignInScreen />, services);
    await userEvent.press(screen.getByTestId('persona-advisor'));
    expect(screen.getByLabelText('E-mail').props.value).toBe('carlos@pitlane.app');
    expect(screen.getByTestId('persona-advisor')).toBeSelected();
    await userEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(useSession.getState().user?.role.key).toBe('advisor'));
  });

  it('validates fields and reports wrong credentials', async () => {
    await renderWithServices(<SignInScreen />, services);
    const email = screen.getByLabelText('E-mail');
    await userEvent.clear(email);
    await userEvent.type(email, 'not-an-email');
    await userEvent.press(screen.getByTestId('sign-in'));
    expect(await screen.findByText('Enter a valid e-mail')).toBeOnTheScreen();

    await userEvent.clear(email);
    await userEvent.type(email, 'ana@pitlane.app');
    const password = screen.getByLabelText('Password');
    await userEvent.clear(password);
    await userEvent.type(password, 'wrong-password');
    await userEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(toasts()).toContain('E-mail or password is incorrect.'));
    expect(useSession.getState().status).not.toBe('signedIn');
  });

  it('locks out after repeated failures', async () => {
    await renderWithServices(<SignInScreen />, services);
    const password = screen.getByLabelText('Password');
    await userEvent.clear(password);
    await userEvent.type(password, 'wrong-password');
    for (let attempt = 0; attempt < 6; attempt += 1) await userEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(toasts().some((title) => title.startsWith('Too many attempts'))).toBe(true));
  });

  it('asks for biometrics when the session is locked, and can fall back to the password', async () => {
    const user = await signInAs(services, 'owner');
    services.biometrics.authenticated = false;
    useSession.getState().signedIn(user, { locked: true });
    await renderWithServices(<SignInScreen />, services);

    expect(await screen.findByText('Welcome back, Ana')).toBeOnTheScreen();
    expect(useSession.getState().locked).toBe(true);

    services.biometrics.authenticated = true;
    await userEvent.press(screen.getByTestId('unlock'));
    await waitFor(() => expect(useSession.getState().locked).toBe(false));

    services.biometrics.authenticated = false;
    await act(async () => useSession.getState().signedIn(user, { locked: true }));
    await userEvent.press(await screen.findByText('Sign in with password'));
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('surfaces unexpected failures from the sign-in use case', async () => {
    jest.spyOn(services.container.useCases.signIn, 'execute').mockResolvedValue(Result.fail('auth.locked', { seconds: 42 }));
    await renderWithServices(<SignInScreen />, services);
    await userEvent.press(screen.getByTestId('sign-in'));
    await waitFor(() => expect(toasts()).toContain('Too many attempts. Try again in 42 s.'));
  });
});
