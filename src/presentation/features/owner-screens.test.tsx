import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import { Result } from '@/domain/shared/result';
import { Vin } from '@/domain/vehicle/vin';
import { createTestServices, renderWithServices, signInAs, TestServices } from '@/test-utils/render';
import { resetRouter, routerSpy, setRouteParams } from '@/test-utils/router-mock';

import { useSession } from '../state/session-store';
import { useToasts } from '../state/toast-store';
import { BookingScreen } from './booking/booking-screen';
import { DealersScreen } from './dealers/dealers-screen';
import { GarageScreen } from './garage/garage-screen';
import { PassScreen } from './pass/pass-screen';
import { ScanScreen } from './scan/scan-screen';
import { VehicleScreen } from './vehicle/vehicle-screen';

jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock);
jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));
jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  const camera = { permission: { granted: true }, request: jest.fn(), onScan: null as unknown };
  return {
    __esModule: true,
    __camera: camera,
    useCameraPermissions: () => [camera.permission, camera.request],
    CameraView: (props: { onBarcodeScanned: unknown }) => {
      camera.onScan = props.onBarcodeScanned;
      return <View testID="camera" />;
    },
  };
});

jest.setTimeout(30000);

type CameraMock = { permission: { granted: boolean }; request: jest.Mock; onScan: null | ((scan: { data: string }) => void) };
const camera = (jest.requireMock('expo-camera') as { __camera: CameraMock }).__camera;
const toasts = () => useToasts.getState().toasts.map((toast) => toast.title);

let services: TestServices;

beforeEach(async () => {
  resetRouter();
  camera.permission = { granted: true };
  camera.request.mockClear();
  services = await createTestServices();
  await signInAs(services, 'owner');
});

const firstVehicle = async () => {
  const user = (await signInAs(services, 'owner'));
  const garage = (await services.container.useCases.getGarage.execute(user)).value;
  return { user, garage, vehicle: garage.vehicles[0]!.vehicle };
};

describe('GarageScreen', () => {
  it('greets the owner, shows the vehicle card and routes to booking, specs, scan and offers', async () => {
    const { vehicle } = await firstVehicle();
    await renderWithServices(<GarageScreen />, services);

    expect(await screen.findByText(/Ana/)).toBeOnTheScreen();
    expect(screen.getByTestId('garage-screen')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId(`book-${vehicle.id}`));
    expect(routerSpy.push).toHaveBeenLastCalledWith({ pathname: '/booking', params: { vehicleId: vehicle.id } });
    await userEvent.press(screen.getByTestId(`specs-${vehicle.id}`));
    expect(routerSpy.push).toHaveBeenLastCalledWith(`/vehicle/${vehicle.id}`);
    await userEvent.press(screen.getByTestId('add-vehicle'));
    expect(routerSpy.push).toHaveBeenLastCalledWith('/scan');
    await userEvent.press(screen.getByTestId('scan-cta'));
    expect(routerSpy.push).toHaveBeenLastCalledWith('/scan');

    const offer = screen.queryAllByTestId(/^offer-/)[0];
    if (offer) {
      await userEvent.press(offer);
      expect(routerSpy.push).toHaveBeenLastCalledWith({ pathname: '/booking', params: expect.objectContaining({ vehicleId: vehicle.id, serviceType: expect.any(String) }) });
    }
  });

  it('shows the next visit ticket after booking and opens its pass', async () => {
    const { user, vehicle } = await firstVehicle();
    const nearby = (await services.container.useCases.listDealersNearby.execute(user)).value;
    const dealerId = nearby.dealers[0]!.dealer.id;
    const slots = (await services.container.useCases.getAvailability.execute({ dealerId, serviceType: 'oil', day: new Date('2026-09-29T12:00:00Z') })).value;

    await renderWithServices(<GarageScreen />, services);
    await screen.findByText(/Ana/);
    const before = screen.queryByTestId('next-visit');

    const booked = (await services.container.useCases.bookAppointment.execute(user, { vehicleId: vehicle.id, dealerId, serviceType: 'oil', start: slots[0]!.slot.start })).value;
    const ticket = await screen.findByTestId('next-visit');
    expect(ticket).toBeOnTheScreen();
    expect(before === null || before !== ticket).toBe(true);
    await userEvent.press(ticket);
    expect(routerSpy.push).toHaveBeenLastCalledWith(`/pass/${booked.id}`);
  });

  it('swaps the card and pulses a haptic when the carousel settles on another vehicle', async () => {
    const { user, garage } = await firstVehicle();
    if (garage.vehicles.length < 2) {
      const dealer = garage.dealers.values().next().value!;
      const registered = await services.container.useCases.registerVehicle.execute(user, {
        vin: Vin.withCheckDigit('9BFZZZ540PB000001').value,
        modelKey: 'ranger',
        mileageKm: 12000,
        purchasedAt: new Date('2025-01-10'),
      });
      expect(registered.isOk()).toBe(true);
      expect(dealer).toBeDefined();
    }
    const select = jest.spyOn(services.haptics, 'select');
    await renderWithServices(<GarageScreen />, services);
    const carousel = await screen.findByTestId('vehicle-carousel');
    await fireEvent(carousel, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 351 + 12, y: 0 } } });
    expect(select).toHaveBeenCalled();
  });

  it('shows a retryable error when the garage cannot load', async () => {
    useToasts.setState({ toasts: [] });
    const spy = jest.spyOn(services.container.useCases.getGarage, 'execute').mockResolvedValue(
      Result.fail('auth.forbidden'),
    );
    await renderWithServices(<GarageScreen />, services);
    expect(await screen.findByText('You do not have access to this.')).toBeOnTheScreen();
    spy.mockRestore();
    await userEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Ana/)).toBeOnTheScreen();
  });
});

describe('BookingScreen', () => {
  it('walks service → dealer → slot → review and confirms, then offers the pass', async () => {
    const { vehicle } = await firstVehicle();
    setRouteParams({ vehicleId: vehicle.id });
    await renderWithServices(<BookingScreen />, services);

    await userEvent.press(await screen.findByTestId('service-oil'));
    const [dealerRow] = await screen.findAllByTestId(/^dealer-/);
    await userEvent.press(dealerRow!);
    await userEvent.press(screen.getByTestId('booking-next'));

    const slot = (await screen.findAllByTestId(/^slot-/))[0]!;
    await userEvent.press(slot);
    await userEvent.press(screen.getByTestId('booking-next'));

    expect(await screen.findByTestId('review-service')).toHaveTextContent('Oil change');
    await userEvent.type(screen.getByTestId('booking-notes'), 'Strange noise');
    await userEvent.press(screen.getByTestId('booking-confirm'));

    expect(await screen.findByTestId('booking-success')).toBeOnTheScreen();
    expect(toasts()).toContain('You are booked!');
    await userEvent.press(screen.getByTestId('view-pass'));
    expect(routerSpy.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/pass\//));
  });

  it('goes back a step, closes, and reports a failure without losing the draft', async () => {
    const { vehicle } = await firstVehicle();
    setRouteParams({ vehicleId: vehicle.id, serviceType: 'oil' });
    await renderWithServices(<BookingScreen />, services);

    await userEvent.press((await screen.findAllByTestId(/^dealer-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));
    await userEvent.press((await screen.findAllByTestId(/^slot-/))[0]!);
    await userEvent.press(screen.getByTestId('booking-next'));
    await screen.findByTestId('booking-confirm');

    const failing = jest.spyOn(services.container.useCases.bookAppointment, 'execute').mockResolvedValue(
      Result.fail('booking.slotTaken'),
    );
    await userEvent.press(screen.getByTestId('booking-confirm'));
    await waitFor(() => expect(toasts()).toContain('That slot was just taken. Pick another time.'));
    failing.mockRestore();

    await userEvent.press(screen.getByTestId('booking-back'));
    await userEvent.press(screen.getByTestId('booking-close'));
    expect(routerSpy.back).toHaveBeenCalled();
  });

  it('shows an error when the vehicle is not in the garage', async () => {
    setRouteParams({ vehicleId: 'nope' });
    await renderWithServices(<BookingScreen />, services);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});

describe('PassScreen', () => {
  const book = async () => {
    const { user, vehicle } = await firstVehicle();
    const nearby = (await services.container.useCases.listDealersNearby.execute(user)).value;
    const dealerId = nearby.dealers[0]!.dealer.id;
    const slots = (await services.container.useCases.getAvailability.execute({ dealerId, serviceType: 'revision', day: new Date('2026-10-05T12:00:00Z') })).value;
    return (await services.container.useCases.bookAppointment.execute(user, { vehicleId: vehicle.id, dealerId, serviceType: 'revision', start: slots[0]!.slot.start })).value;
  };

  it('shows the check-in QR and code, and cancels after confirming', async () => {
    const appointment = await book();
    setRouteParams({ id: appointment.id });
    await renderWithServices(<PassScreen />, services);

    expect(await screen.findByTestId('pass-qr')).toBeOnTheScreen();
    expect(screen.getByTestId('pass-code')).toHaveTextContent(appointment.checkInCode);
    expect(screen.getByTestId('pass-status')).toHaveTextContent('Scheduled');

    await userEvent.press(screen.getByTestId('cancel-booking'));
    expect(screen.getByText('Cancel this booking?')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(routerSpy.back).not.toHaveBeenCalled();

    await userEvent.press(screen.getByTestId('cancel-booking'));
    await userEvent.press(screen.getAllByRole('button', { name: 'Cancel booking' }).at(-1)!);
    await waitFor(() => expect(routerSpy.back).toHaveBeenCalled());
    expect(toasts()).toContain('Booking cancelled');
  });

  it('reports why a booking could not be cancelled', async () => {
    const appointment = await book();
    setRouteParams({ id: appointment.id });
    await renderWithServices(<PassScreen />, services);
    await screen.findByTestId('pass-qr');
    jest.spyOn(services.container.useCases.cancelAppointment, 'execute').mockResolvedValue(
      Result.fail('appointment.tooLateToCancel'),
    );
    await userEvent.press(screen.getByTestId('cancel-booking'));
    await userEvent.press(screen.getAllByRole('button', { name: 'Cancel booking' }).at(-1)!);
    await waitFor(() => expect(toasts()).toContain('Bookings can only be cancelled up to 2 hours before.'));
    expect(routerSpy.back).not.toHaveBeenCalled();
  });

  it('handles an unknown pass', async () => {
    setRouteParams({ id: 'missing' });
    await renderWithServices(<PassScreen />, services);
    expect(await screen.findByText('Booking not found.')).toBeOnTheScreen();
  });
});

describe('VehicleScreen', () => {
  it('shows the spec sheet with explicit gaps, history and a booking shortcut for the owner', async () => {
    const { vehicle } = await firstVehicle();
    setRouteParams({ id: vehicle.id });
    await renderWithServices(<VehicleScreen />, services);

    expect(await screen.findByTestId('spec-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('spec-engine')).toBeOnTheScreen();
    expect(screen.getByText('Technical specifications')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('book-from-vehicle'));
    expect(routerSpy.push).toHaveBeenCalledWith({ pathname: '/booking', params: { vehicleId: vehicle.id } });
    await userEvent.press(screen.getByTestId('back'));
    expect(routerSpy.back).toHaveBeenCalled();
  });

  it('hides the booking shortcut from advisors and reports missing vehicles', async () => {
    const { vehicle } = await firstVehicle();
    await signInAs(services, 'advisor');
    setRouteParams({ id: vehicle.id });
    await renderWithServices(<VehicleScreen />, services);
    await screen.findByTestId('spec-sheet');
    expect(screen.queryByTestId('book-from-vehicle')).not.toBeOnTheScreen();

    setRouteParams({ id: 'ghost' });
    await renderWithServices(<VehicleScreen />, services);
    expect(await screen.findAllByText('Something went wrong. Please try again.')).not.toHaveLength(0);
  });
});

describe('DealersScreen', () => {
  it('ranks dealers, points the compass arrow using the phone heading and books / calls', async () => {
    const { vehicle } = await firstVehicle();
    await renderWithServices(<DealersScreen />, services);

    expect(await screen.findByTestId('compass-hero')).toBeOnTheScreen();
    expect(screen.getAllByTestId('bearing-arrow').length).toBeGreaterThan(1);
    await act(async () => {
      services.heading.emit(350);
      services.heading.emit(10);
    });

    const rows = screen.getAllByTestId(/^dealer-/);
    const id = rows[0]!.props.testID.replace('dealer-', '');
    await userEvent.press(screen.getByTestId(`book-at-${id}`));
    expect(routerSpy.push).toHaveBeenCalledWith({ pathname: '/booking', params: { vehicleId: vehicle.id, dealerId: id } });
    await userEvent.press(screen.getByTestId(`call-${id}`));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^tel:\+?[\d-]+$/));
  });

  it('stops listening to the compass on unmount', async () => {
    await firstVehicle();
    const view = await renderWithServices(<DealersScreen />, services);
    await screen.findByTestId('compass-hero');
    await view.unmount();
    expect(services.heading.stops).toBe(1);
  });

  it('sends owners without a vehicle to add one first', async () => {
    const user = await signInAs(services, 'owner');
    const garage = (await services.container.useCases.getGarage.execute(user)).value;
    jest.spyOn(services.container.useCases.getGarage, 'execute').mockResolvedValue(Result.ok({ ...garage, vehicles: [] }));
    await renderWithServices(<DealersScreen />, services);
    const [first] = await screen.findAllByTestId(/^book-at-/);
    await userEvent.press(first!);
    expect(routerSpy.push).toHaveBeenCalledWith('/scan');
  });
});

describe('ScanScreen', () => {
  const vin = () => Vin.withCheckDigit('9BFZZZ540PB123456').value;

  it('decodes a typed VIN live and registers the vehicle in the garage', async () => {
    await renderWithServices(<ScanScreen />, services);
    await userEvent.press(screen.getByText('Type the VIN'));

    await userEvent.type(screen.getByTestId('vin-input'), vin().toLowerCase());
    expect(await screen.findByTestId('vin-decode')).toBeOnTheScreen();
    expect(screen.getByText('Ford vehicle')).toBeOnTheScreen();
    expect(screen.getByText('Assembled in Brazil')).toBeOnTheScreen();
    expect(screen.getByText('Check digit verified')).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('model-maverick'));
    await userEvent.type(screen.getByTestId('mileage-input'), '18a500');
    await userEvent.press(screen.getByTestId(`year-${services.container.clock.now().getFullYear() - 1}`));
    await userEvent.type(screen.getByTestId('nickname-input'), 'Maverick da Ana');
    await userEvent.press(screen.getByTestId('register-vehicle'));

    await waitFor(() => expect(routerSpy.back).toHaveBeenCalled());
    expect(toasts()).toContain('Maverick da Ana added to your garage');
    const garage = (await services.container.useCases.getGarage.execute(useSession.getState().user!)).value;
    expect(garage.vehicles.some((entry) => entry.vehicle.vin.value === vin())).toBe(true);
  });

  it('warns about non-Ford VINs and surfaces the domain error on submit', async () => {
    await renderWithServices(<ScanScreen />, services);
    await userEvent.press(screen.getByText('Type the VIN'));
    await userEvent.type(screen.getByTestId('vin-input'), Vin.withCheckDigit('1HGCM8263XA004352'.replace('X', '0')).value);
    expect(await screen.findByText('Not a Ford VIN')).toBeOnTheScreen();
    await userEvent.type(screen.getByTestId('mileage-input'), '1000');
    await userEvent.press(screen.getByTestId('register-vehicle'));
    await waitFor(() => expect(toasts()).toContain('This VIN does not belong to a Ford.'));
    expect(routerSpy.back).not.toHaveBeenCalled();
  });

  it('keeps the register button disabled until the form is valid', async () => {
    await renderWithServices(<ScanScreen />, services);
    await userEvent.press(screen.getByText('Type the VIN'));
    await userEvent.type(screen.getByTestId('vin-input'), 'ABC');
    expect(screen.getByTestId('register-vehicle')).toBeDisabled();
    expect(await screen.findByText('A VIN has 17 letters and digits (no I, O or Q)')).toBeOnTheScreen();
  });

  it('fills the VIN from the camera, ignoring noise and the "I" prefix, once', async () => {
    await renderWithServices(<ScanScreen />, services);
    expect(await screen.findByTestId('camera')).toBeOnTheScreen();

    await act(async () => camera.onScan?.({ data: 'not a vin' }));
    expect(screen.getByTestId('camera')).toBeOnTheScreen();
    await act(async () => camera.onScan?.({ data: `I${vin()}` }));
    await waitFor(() => expect(screen.getByTestId('vin-input').props.value).toBe(vin()));
    expect(screen.queryByTestId('camera')).not.toBeOnTheScreen();
  });

  it('asks for camera permission before scanning, and can be closed', async () => {
    camera.permission = { granted: false };
    await renderWithServices(<ScanScreen />, services);
    expect(await screen.findByTestId('camera-permission')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('allow-camera'));
    expect(camera.request).toHaveBeenCalledTimes(1);
    await userEvent.press(screen.getByTestId('close-scan'));
    expect(routerSpy.back).toHaveBeenCalled();
  });
});
