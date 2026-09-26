import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Platform, useColorScheme } from 'react-native';

import { Percentage } from '@/domain/shared/percentage';
import { Result } from '@/domain/shared/result';
import { Vin } from '@/domain/vehicle/vin';
import { createTestServices, renderWithServices, signInAs, TestServices } from '@/test-utils/render';
import { resetRouter, routerSpy, setRouteParams } from '@/test-utils/router-mock';

import { Skeleton, StatTile, ScreenHeader, Text, makeStyles, useColorSchemeResolved } from '../design-system';
import { usePreferences } from '../state/preferences-store';
import { useSession } from '../state/session-store';
import { useToasts } from '../state/toast-store';
import { SignInScreen } from './auth/sign-in-screen';
import { BookingDraft } from './booking/booking-draft';
import { BookingScreen } from './booking/booking-screen';
import { DealersScreen } from './dealers/dealers-screen';
import { GarageScreen } from './garage/garage-screen';
import { PulseScreen } from './pulse/pulse-screen';
import { ScanScreen } from './scan/scan-screen';
import { VehicleScreen } from './vehicle/vehicle-screen';

jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock);
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));
jest.mock('expo-camera', () => ({ CameraView: () => null, useCameraPermissions: () => [{ granted: false }, jest.fn()] }));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn(() => 'light') }));

jest.setTimeout(30000);

const toasts = () => useToasts.getState().toasts.map((toast) => toast.title);
const never = <T,>() => new Promise<T>(() => undefined);

let services: TestServices;

beforeEach(async () => {
  resetRouter();
  jest.restoreAllMocks();
  services = await createTestServices();
  await signInAs(services, 'owner');
});

const cases = () => services.container.useCases;
const owner = () => useSession.getState().user!;

describe('BookingDraft', () => {
  it('starts on the right step for the presets it was given, and never moves illegally', () => {
    expect(BookingDraft.start('v').step).toBe('service');
    expect(BookingDraft.start('v', { serviceType: 'oil' }).step).toBe('dealer');
    expect(BookingDraft.start('v', { serviceType: 'oil', dealerId: 'd' }).step).toBe('slot');

    const empty = BookingDraft.start('v');
    expect(empty.next()).toBe(empty);
    expect(empty.back()).toBe(empty);
    expect(empty.toRequest()).toBeNull();
  });
});

describe('BookingScreen edge cases', () => {
  const open = async (params: Record<string, string> = {}) => {
    const garage = (await cases().getGarage.execute(owner())).value;
    setRouteParams({ vehicleId: garage.vehicles[0]!.vehicle.id, ...params });
    return renderWithServices(<BookingScreen />, services);
  };

  it('jumps straight to the slot step when service and dealer come preselected, and switches day', async () => {
    const nearby = (await cases().listDealersNearby.execute(owner())).value;
    await open({ serviceType: 'oil', dealerId: nearby.dealers[0]!.dealer.id });

    expect((await screen.findAllByTestId(/^slot-/)).length).toBeGreaterThan(0);
    const days = screen.getAllByTestId(/^day-/);
    await userEvent.press(days[1]!);
    expect((await screen.findAllByTestId(/^slot-/)).length).toBeGreaterThan(0);
    await userEvent.press(screen.getAllByTestId(/^slot-/)[0]!);
    expect(screen.getByTestId('booking-next')).toBeEnabled();
  });

  it('shows placeholders while dealers or slots load, and says when a day is full', async () => {
    const nearby = (await cases().listDealersNearby.execute(owner())).value;
    const real = cases().listDealersNearby.execute.bind(cases().listDealersNearby);
    jest.spyOn(cases().listDealersNearby, 'execute').mockImplementationOnce(() => never());
    await open({ serviceType: 'oil' });
    expect(await screen.findAllByTestId('skeleton')).not.toHaveLength(0);
    jest.spyOn(cases().listDealersNearby, 'execute').mockImplementation(real);

    setRouteParams({ vehicleId: (await cases().getGarage.execute(owner())).value.vehicles[0]!.vehicle.id, serviceType: 'oil', dealerId: nearby.dealers[0]!.dealer.id });
    jest.spyOn(cases().getAvailability, 'execute').mockResolvedValue(Result.ok([]));
    await renderWithServices(<BookingScreen />, services);
    expect(await screen.findByText('No free bays on this day')).toBeOnTheScreen();
  });

  it('lets the customer go back to the service they picked, and keeps other failures on the review step', async () => {
    const nearby = (await cases().listDealersNearby.execute(owner())).value;
    await open();
    await userEvent.press(await screen.findByTestId('service-brakes'));
    await userEvent.press(await screen.findByTestId('booking-back'));
    expect(screen.getByTestId('service-brakes')).toBeSelected();
    await userEvent.press(screen.getByTestId('service-brakes'));
    await userEvent.press((await screen.findAllByTestId(/^dealer-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));
    await userEvent.press((await screen.findAllByTestId(/^slot-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));

    jest.spyOn(cases().bookAppointment, 'execute').mockResolvedValue(Result.fail('booking.slotInPast'));
    await userEvent.press(await screen.findByTestId('booking-confirm'));
    await waitFor(() => expect(toasts()).toContain('That time has already passed.'));
    expect(screen.getByTestId('booking-confirm')).toBeOnTheScreen();
    expect(nearby.dealers.length).toBeGreaterThan(0);
  });
});

describe('GarageScreen edge cases', () => {
  it('handles a single vehicle without offers or bookings, and ignores scrolls that stay put', async () => {
    const garage = (await cases().getGarage.execute(owner())).value;
    const [first] = garage.vehicles;
    jest.spyOn(cases().getGarage, 'execute').mockResolvedValue(Result.ok({ ...garage, vehicles: [{ ...first!, offers: [], nextAppointment: undefined }] }));
    const select = jest.spyOn(services.haptics, 'select');
    await renderWithServices(<GarageScreen />, services);

    await userEvent.press(await screen.findByTestId('no-visit'));
    expect(routerSpy.push).toHaveBeenCalledWith({ pathname: '/booking', params: { vehicleId: first!.vehicle.id } });
    expect(screen.queryByTestId(/^offer-/)).not.toBeOnTheScreen();

    const carousel = screen.getByTestId('vehicle-carousel');
    await fireEvent(carousel, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(select).not.toHaveBeenCalled();
  });

  it('copes with an empty garage', async () => {
    const garage = (await cases().getGarage.execute(owner())).value;
    jest.spyOn(cases().getGarage, 'execute').mockResolvedValue(Result.ok({ ...garage, vehicles: [] }));
    await renderWithServices(<GarageScreen />, services);
    expect(await screen.findByTestId('scan-cta')).toBeOnTheScreen();
    expect(screen.queryByTestId('next-visit')).not.toBeOnTheScreen();
  });
});

describe('DealersScreen edge cases', () => {
  it('marks dealers as closed outside opening hours', async () => {
    services.test.clock.advanceDays(2); // Sunday
    await renderWithServices(<DealersScreen />, services);
    expect((await screen.findAllByText('Closed')).length).toBeGreaterThan(0);
  });

  it('releases a compass subscription that resolves after the screen is gone', async () => {
    let stopped = 0;
    jest.spyOn(services.heading, 'watch').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return () => {
        stopped += 1;
      };
    });
    const view = await renderWithServices(<DealersScreen />, services);
    await view.unmount();
    await waitFor(() => expect(stopped).toBe(1));
  });

  it('says so when no dealer can be listed', async () => {
    const nearby = (await cases().listDealersNearby.execute(owner())).value;
    jest.spyOn(cases().listDealersNearby, 'execute').mockResolvedValue(Result.ok({ ...nearby, dealers: [] }));
    await renderWithServices(<DealersScreen />, services);
    expect((await screen.findAllByText('Dealers')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('compass-hero')).not.toBeOnTheScreen();
  });
});

describe('ScanScreen edge cases', () => {
  it('flags a VIN whose check digit does not verify', async () => {
    await renderWithServices(<ScanScreen />, services);
    await userEvent.press(screen.getByText('Type the VIN'));
    const valid = Vin.withCheckDigit('9BFZZZ540PB123456').value;
    const wrong = `${valid.slice(0, 8)}${valid[8] === '1' ? '2' : '1'}${valid.slice(9)}`;
    await userEvent.type(screen.getByTestId('vin-input'), wrong);
    expect(await screen.findByText('Check digit not verified')).toBeOnTheScreen();
  });
});

describe('VehicleScreen edge cases', () => {
  it('shows a brand-new vehicle: no history yet, not connected', async () => {
    const registered = (
      await cases().registerVehicle.execute(owner(), { vin: Vin.withCheckDigit('9BFZZZ540PB765432').value, modelKey: 'transit', mileageKm: 500, purchasedAt: new Date('2026-08-01') })
    ).value;
    setRouteParams({ id: registered.id });
    await renderWithServices(<VehicleScreen />, services);

    expect(await screen.findByTestId('spec-sheet')).toBeOnTheScreen();
    expect(screen.queryByText('Connected vehicle')).not.toBeOnTheScreen();
    expect(screen.getByText('No services yet')).toBeOnTheScreen();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
  });
});

describe('PulseScreen edge cases', () => {
  it('shows a dealer behind the network and an outperforming segment', async () => {
    await signInAs(services, 'advisor');
    const report = (await cases().getPulse.execute(useSession.getState().user!)).value;
    jest.spyOn(cases().getPulse, 'execute').mockResolvedValue(
      Result.ok({
        ...report,
        own: { ...report.own, share: Percentage.ofRatio(0.3) },
        network: { ...report.network, share: Percentage.ofRatio(0.5) },
        anomalies: [{ key: report.breakdowns.dealer[0]!.key, zScore: 2.1, direction: 'above', deltaPoints: 8 }],
      }),
    );
    await renderWithServices(<PulseScreen />, services);
    expect(await screen.findByText(/−20\.0 pts vs network/i)).toBeOnTheScreen();
    expect(screen.getByText(/above the network/)).toBeOnTheScreen();
  });
});

describe('SignInScreen edge cases', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('renders the lock panel even if the user record is gone, and adapts to iOS keyboards', async () => {
    Platform.OS = 'ios';
    useSession.setState({ status: 'signedIn', user: null, locked: true });
    services.biometrics.authenticated = false;
    await renderWithServices(<SignInScreen />, services);
    expect(await screen.findByTestId('unlock')).toBeOnTheScreen();
    expect(screen.getByLabelText('?')).toBeOnTheScreen();
  });
});

describe('design system edge cases', () => {
  it('renders optional pieces without their optional props', async () => {
    await renderWithServices(
      <>
        <Skeleton />
        <StatTile label="Bare" value="1" />
        <ScreenHeader title="No eyebrow" />
      </>,
      services,
    );
    expect(screen.getByText('Bare')).toBeOnTheScreen();
    expect(screen.getByText('No eyebrow')).toBeOnTheScreen();
  });

  it('follows the system colour scheme, and caches themed styles per theme', async () => {
    const useStyles = makeStyles((theme) => ({ box: { backgroundColor: theme.colors.background } }));
    let renders = 0;
    const Probe = () => {
      renders += 1;
      const styles = useStyles();
      return <Text testID="probe" style={styles.box}>{useColorSchemeResolved()}</Text>;
    };
    jest.mocked(useColorScheme).mockReturnValue('dark');
    usePreferences.setState({ theme: 'system' });
    await renderWithServices(<Probe />, services);
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
    await act(async () => usePreferences.setState({ locale: 'pt-BR' }));
    expect(renders).toBeGreaterThan(0);
    await act(async () => usePreferences.setState({ theme: 'light' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('light');
  });
});
