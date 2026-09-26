import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { DomainError } from '@/domain/shared/domain-error';
import { Result } from '@/domain/shared/result';
import { createTestServices, signInAs, TestServices } from '@/test-utils/render';

import { useFeedback } from '../hooks/use-feedback';
import { useI18n } from '../hooks/use-i18n';
import { useResult } from '../hooks/use-result';
import { ServicesProvider, useHaptics, useServices, useUseCases } from '../providers/services';
import { DEFAULT_PREFERENCES, usePreferences } from './preferences-store';
import { useCurrentUser, useSession } from './session-store';
import { useToasts } from './toast-store';

let services: TestServices;

const wrapper = ({ children }: PropsWithChildren) => <ServicesProvider services={services}>{children}</ServicesProvider>;

beforeEach(async () => {
  services = await createTestServices();
});

describe('preferences store', () => {
  it('starts from defaults and updates each preference', () => {
    usePreferences.setState({ ...DEFAULT_PREFERENCES });
    const state = () => usePreferences.getState();
    expect(state()).toMatchObject({ theme: 'system', locale: 'system', haptics: true, biometricLock: false });
    state().setTheme('dark');
    state().setLocale('pt-BR');
    state().setHaptics(false);
    state().setBiometricLock(true);
    expect(state()).toMatchObject({ theme: 'dark', locale: 'pt-BR', haptics: false, biometricLock: true });
  });
});

describe('session store', () => {
  it('tracks sign in, biometric lock and sign out', async () => {
    const user = await signInAs(services, 'owner');
    expect(useSession.getState()).toMatchObject({ status: 'signedIn', locked: false });
    useSession.getState().signedIn(user, { locked: true });
    expect(useSession.getState().locked).toBe(true);
    useSession.getState().unlock();
    expect(useSession.getState().locked).toBe(false);
    useSession.getState().signedOut();
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', user: null });
  });

  it('exposes the current user only behind the auth guard', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(async () => renderHook(() => useCurrentUser())).rejects.toThrow('outside an authenticated route');
    jest.restoreAllMocks();
    const user = await signInAs(services, 'owner');
    const inside = await renderHook(() => useCurrentUser());
    expect(inside.result.current).toBe(user);
  });
});

describe('toast store', () => {
  it('queues toasts, keeps the latest three and dismisses by id', () => {
    const { show, dismiss } = useToasts.getState();
    const ids = ['t0', 't1', 't2', 't3', 't4'].map((title) => show({ tone: 'primary', title }));
    expect(useToasts.getState().toasts.map((toast) => toast.title)).toEqual(['t2', 't3', 't4']);
    dismiss(ids[4] as number);
    expect(useToasts.getState().toasts.map((toast) => toast.title)).toEqual(['t2', 't3']);
  });
});

describe('services provider', () => {
  it('refuses to work outside the provider and hands out injected services', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(async () => renderHook(() => useServices())).rejects.toThrow('inside <ServicesProvider>');
    jest.restoreAllMocks();
    const { result } = await renderHook(() => ({ all: useServices(), cases: useUseCases(), haptics: useHaptics() }), { wrapper });
    expect(result.current.all).toBe(services);
    expect(result.current.cases).toBe(services.container.useCases);
    expect(result.current.haptics).toBe(services.haptics);
  });
});

describe('useI18n', () => {
  it('follows the locale preference', async () => {
    const { result } = await renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('common.appName')).toBe('Pitlane');
    expect(result.current.t('common.retry')).toBe('Try again');
    await act(async () => usePreferences.getState().setLocale('pt-BR'));
    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.t('common.retry')).toBe('Tentar de novo');
  });
});

describe('useFeedback', () => {
  it('pairs each outcome with a toast and a haptic', async () => {
    const haptics = { success: jest.spyOn(services.haptics, 'success'), select: jest.spyOn(services.haptics, 'select'), error: jest.spyOn(services.haptics, 'error') };
    const { result } = await renderHook(() => useFeedback(), { wrapper });

    await act(async () => result.current.success('Saved', 'All good'));
    await act(async () => result.current.info('FYI'));
    await act(async () => result.current.error(DomainError.of('booking.slotTaken')));

    expect(useToasts.getState().toasts.map((toast) => [toast.tone, toast.title])).toEqual([
      ['success', 'Saved'],
      ['primary', 'FYI'],
      ['danger', 'That slot was just taken. Pick another time.'],
    ]);
    expect(useToasts.getState().toasts[0]?.message).toBe('All good');
    expect(haptics.success).toHaveBeenCalledTimes(1);
    expect(haptics.select).toHaveBeenCalledTimes(1);
    expect(haptics.error).toHaveBeenCalledTimes(1);
  });
});

describe('useResult', () => {
  it('is loading until the use case resolves, then reloads on demand', async () => {
    let release: (value: Result<number>) => void = () => undefined;
    const gate = new Promise<Result<number>>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const { result } = await renderHook(() => useResult(() => (++calls === 1 ? gate : Promise.resolve(Result.ok(calls))), []), { wrapper });
    expect(result.current).toMatchObject({ status: 'loading', data: undefined });

    await act(async () => release(Result.ok(1)));
    expect(result.current).toMatchObject({ status: 'success', data: 1 });

    await act(async () => result.current.reload());
    expect(result.current.data).toBe(2);
    expect(result.current.refreshing).toBe(false);
  });

  it('reports failures, and keeps stale data when a later refresh fails', async () => {
    let fail = true;
    const { result } = await renderHook(() => useResult(async () => (fail ? Result.fail<number>('vin.notFord') : Result.ok(7)), []), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.code).toBe('vin.notFord');

    fail = false;
    await act(async () => result.current.reload());
    expect(result.current).toMatchObject({ status: 'success', data: 7 });

    fail = true;
    await act(async () => result.current.reload());
    expect(result.current).toMatchObject({ status: 'success', data: 7 });
    expect(result.current.error?.code).toBe('vin.notFord');
  });

  it('refreshes silently when a subscribed domain event fires, and ignores the others', async () => {
    let calls = 0;
    const invalidateOn = ['appointment.booked'] as const;
    const { result } = await renderHook(() => useResult(async () => Result.ok(++calls), [], { invalidateOn }), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(1));

    await act(async () => services.container.events.publish({ type: 'lead.updated', vehicleId: 'x' }));
    expect(calls).toBe(1);
    await act(async () => services.container.events.publish({ type: 'appointment.booked', appointmentId: 'a' }));
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(result.current.refreshing).toBe(false);
  });

  it('re-runs when its dependencies change and unsubscribes on unmount', async () => {
    const listeners = services.container.events.listenerCount;
    const { result, rerender, unmount } = await renderHook(
      ({ id }: { id: number }) => useResult(async () => Result.ok(id), [id], { invalidateOn: ['data.reset'] }),
      { wrapper, initialProps: { id: 1 } },
    );
    await waitFor(() => expect(result.current.data).toBe(1));
    expect(services.container.events.listenerCount).toBe(listeners + 1);
    await rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe(2));
    await unmount();
    expect(services.container.events.listenerCount).toBe(listeners);
  });
});
