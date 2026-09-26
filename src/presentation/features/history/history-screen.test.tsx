import { screen, userEvent } from '@testing-library/react-native';

import { createTestServices, renderWithServices, signInAs, TestServices } from '@/test-utils/render';
import { resetRouter, routerSpy } from '@/test-utils/router-mock';

import { HistoryScreen } from './history-screen';

jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock);

let services: TestServices;

beforeEach(async () => {
  resetRouter();
  services = await createTestServices();
  await signInAs(services, 'owner');
});

describe('HistoryScreen', () => {
  it('lists past services grouped by year, with the network badge', async () => {
    await renderWithServices(<HistoryScreen />, services);

    expect(await screen.findByText('History')).toBeOnTheScreen();
    expect(screen.getAllByText('Ford network').length).toBeGreaterThan(0);
    expect(screen.getByText('2026')).toBeOnTheScreen();
  });

  it('opens the service pass of a booking and shows new bookings without reloading', async () => {
    await renderWithServices(<HistoryScreen />, services);
    await screen.findByText('History');

    const user = await services.container.useCases.signIn.execute({ email: 'ana@pitlane.app', password: 'ford2026' });
    const garage = (await services.container.useCases.getGarage.execute(user.value)).value;
    const vehicle = garage.vehicles[0]?.vehicle;
    const slots = await services.container.useCases.getAvailability.execute({ dealerId: garage.dealers.keys().next().value as string, serviceType: 'oil', day: new Date('2026-09-28T12:00:00Z') });
    const booked = await services.container.useCases.bookAppointment.execute(user.value, {
      vehicleId: vehicle?.id as string,
      dealerId: garage.dealers.keys().next().value as string,
      serviceType: 'oil',
      start: slots.value[0]?.slot.start as Date,
    });
    expect(booked.isOk()).toBe(true);

    const row = await screen.findByTestId(`timeline-${booked.value.id}`);
    await userEvent.press(row);
    expect(routerSpy.push).toHaveBeenCalledWith(`/pass/${booked.value.id}`);
    expect(screen.getByText('Booked')).toBeOnTheScreen();
  });
});
