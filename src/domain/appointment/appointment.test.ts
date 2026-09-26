import { aDealer, aVehicle } from '../__fixtures__/builders';
import { Money } from '../shared/money';
import { Appointment, AppointmentProps } from './appointment';
import { AppointmentBuilder } from './appointment-builder';
import { Appointments } from './appointments';
import { SlotPlanner } from './slot-planner';
import { TimeSlot } from './time-slot';

// Friday 25 Sep 2026, 09:00 local time.
const NOW = new Date(2026, 8, 25, 9, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

const anAppointment = (overrides: Partial<AppointmentProps> & { id?: string } = {}) => {
  const { id = 'apt-1', ...props } = overrides;
  return Appointment.restore(id, {
    vehicleId: 'veh-1',
    customerId: 'cus-1',
    dealerId: 'dlr-1',
    serviceType: 'revision',
    slot: TimeSlot.restore(at(28, 10), 120),
    status: 'scheduled',
    checkInCode: 'PIT-7K3Q',
    estimate: Money.brl(1290),
    notes: null,
    createdAt: NOW,
    ...props,
  });
};

describe('TimeSlot', () => {
  it('validates and compares', () => {
    expect(TimeSlot.create(new Date('nope'), 60).error.code).toBe('slot.invalidStart');
    expect(TimeSlot.create(NOW, 0).error.code).toBe('slot.invalidDuration');
    expect(TimeSlot.create(NOW, 1.5).error.code).toBe('slot.invalidDuration');
    expect(TimeSlot.create(NOW, 9 * 60).error.code).toBe('slot.invalidDuration');
    const slot = TimeSlot.restore(at(28, 10), 60);
    expect(slot.minutes).toBe(60);
    expect(slot.end.getHours()).toBe(11);
    expect(slot.overlaps(TimeSlot.restore(at(28, 10, 30), 60))).toBe(true);
    expect(slot.overlaps(TimeSlot.restore(at(28, 11), 60))).toBe(false);
    expect(slot.isBefore(at(28, 11))).toBe(true);
    expect(slot.isBefore(at(27, 11))).toBe(false);
  });
});

describe('Appointment state machine', () => {
  it('exposes its data', () => {
    const appointment = anAppointment({ notes: 'Barulho no freio' });
    expect(appointment.vehicleId).toBe('veh-1');
    expect(appointment.customerId).toBe('cus-1');
    expect(appointment.dealerId).toBe('dlr-1');
    expect(appointment.serviceType).toBe('revision');
    expect(appointment.checkInCode).toBe('PIT-7K3Q');
    expect(appointment.estimate.amount).toBe(1290);
    expect(appointment.notes).toBe('Barulho no freio');
    expect(appointment.createdAt).toEqual(NOW);
    expect(appointment.status).toBe('scheduled');
  });

  it('checks in, completes and refuses illegal transitions', () => {
    const appointment = anAppointment();
    expect(appointment.complete().error.code).toBe('appointment.invalidTransition');
    expect(appointment.checkIn().isOk()).toBe(true);
    expect(appointment.isActive()).toBe(true);
    expect(appointment.complete().isOk()).toBe(true);
    expect(appointment.isActive()).toBe(false);
    expect(appointment.cancel(NOW).error.details).toEqual({ from: 'completed', to: 'cancelled' });
  });

  it('cancels only ahead of the cancellation window', () => {
    const soon = anAppointment({ slot: TimeSlot.restore(at(25, 10), 60) });
    expect(soon.canCancel(NOW)).toBe(false);
    expect(soon.cancel(NOW).error.code).toBe('appointment.tooLateToCancel');
    const later = anAppointment();
    expect(later.canCancel(NOW)).toBe(true);
    expect(later.cancel(NOW).isOk()).toBe(true);
    expect(later.status).toBe('cancelled');
    expect(later.isUpcoming(NOW)).toBe(false);
  });
});

describe('Appointments', () => {
  const past = anAppointment({ id: 'past', slot: TimeSlot.restore(at(20, 10), 60), status: 'completed' });
  const older = anAppointment({ id: 'older', slot: TimeSlot.restore(at(10, 10), 60), status: 'cancelled' });
  const next = anAppointment({ id: 'next', slot: TimeSlot.restore(at(26, 9), 60) });
  const later = anAppointment({ id: 'later', vehicleId: 'veh-2' });
  const list = Appointments.of([later, older, past, next]);

  it('splits upcoming and past', () => {
    expect(list.upcoming(NOW).map((a) => a.id)).toEqual(['next', 'later']);
    expect(list.next(NOW)?.id).toBe('next');
    expect(list.past(NOW).map((a) => a.id)).toEqual(['past', 'older']);
    expect(list.forVehicle('veh-2').map((a) => a.id)).toEqual(['later']);
    expect(list.active().size).toBe(2);
  });
});

describe('AppointmentBuilder', () => {
  const vehicle = aVehicle({ id: 'veh-1' });
  const dealer = aDealer({ id: 'dlr-1', services: ['revision', 'oil'] });
  const params = { id: 'apt-9', checkInCode: 'PIT-AAAA', now: NOW };

  it('requires every step', () => {
    expect(AppointmentBuilder.create().build(params).error.code).toBe('booking.vehicleRequired');
    expect(AppointmentBuilder.create().forVehicle(vehicle).build(params).error.code).toBe('booking.dealerRequired');
    expect(AppointmentBuilder.create().forVehicle(vehicle).atDealer(dealer).build(params).error.code).toBe('booking.serviceRequired');
    expect(AppointmentBuilder.create().forVehicle(vehicle).atDealer(dealer).ofType('oil').build(params).error.code).toBe('booking.slotRequired');
  });

  it('enforces dealer capability and future slots', () => {
    const builder = AppointmentBuilder.create().forVehicle(vehicle).atDealer(dealer);
    expect(builder.ofType('brakes').startingAt(at(28, 10)).build(params).error.code).toBe('booking.serviceUnavailable');
    expect(builder.ofType('oil').startingAt(at(24, 10)).build(params).error.code).toBe('booking.slotInPast');
  });

  it('builds a scheduled appointment with estimate and trimmed notes', () => {
    const appointment = AppointmentBuilder.create()
      .forVehicle(vehicle)
      .atDealer(dealer)
      .ofType('oil')
      .startingAt(at(28, 10))
      .withNotes('  check the wipers  ')
      .build(params).value;
    expect(appointment.id).toBe('apt-9');
    expect(appointment.status).toBe('scheduled');
    expect(appointment.slot.minutes).toBe(60);
    expect(appointment.estimate.amount).toBeCloseTo(451.5);
    expect(appointment.notes).toBe('check the wipers');
    expect(AppointmentBuilder.create().withNotes('   ')).toBeInstanceOf(AppointmentBuilder);
    const noNotes = AppointmentBuilder.create().forVehicle(vehicle).atDealer(dealer).ofType('oil').startingAt(at(28, 10)).withNotes(undefined).build(params).value;
    expect(noNotes.notes).toBeNull();
  });
});

describe('SlotPlanner', () => {
  const planner = new SlotPlanner();
  const dealer = aDealer({ id: 'dlr-1', bays: 1 });

  it('returns nothing on Sundays', () => {
    expect(planner.availability({ dealer, day: at(27, 0), durationMinutes: 60, booked: Appointments.of([]), now: NOW })).toEqual([]);
  });

  it('skips lunch, past times and the lead window', () => {
    const slots = planner.availability({ dealer, day: at(25, 0), durationMinutes: 60, booked: Appointments.of([]), now: NOW });
    const hours = slots.map((entry) => `${entry.slot.start.getHours()}:${entry.slot.start.getMinutes()}`);
    expect(hours[0]).toBe('10:0');
    expect(hours).not.toContain('11:30');
    expect(hours).not.toContain('12:0');
    expect(hours).toContain('13:0');
    expect(hours[hours.length - 1]).toBe('17:0');
  });

  it('respects Saturday half-day and bay capacity', () => {
    const saturday = planner.availability({ dealer, day: at(26, 0), durationMinutes: 120, booked: Appointments.of([]), now: NOW });
    expect(saturday.map((entry) => entry.slot.start.getHours())).toEqual([8, 8, 9, 9, 10]);

    const booked = Appointments.of([
      anAppointment({ dealerId: 'dlr-1', slot: TimeSlot.restore(at(28, 8), 120) }),
      anAppointment({ id: 'other-dealer', dealerId: 'dlr-2', slot: TimeSlot.restore(at(28, 14), 60) }),
      anAppointment({ id: 'cancelled', status: 'cancelled', slot: TimeSlot.restore(at(28, 15), 60) }),
    ]);
    const monday = planner.availability({ dealer, day: at(28, 0), durationMinutes: 60, booked, now: NOW });
    const starts = monday.map((entry) => entry.slot.start.getHours() * 60 + entry.slot.start.getMinutes());
    expect(starts[0]).toBe(10 * 60);
    expect(starts).toContain(14 * 60);
    expect(starts).toContain(15 * 60);
    expect(monday.every((entry) => entry.freeBays === 1)).toBe(true);
  });

  it('lists upcoming open days skipping Sundays', () => {
    const days = planner.upcomingDays(at(25, 15), 3);
    expect(days.map((day) => day.getDate())).toEqual([25, 26, 28]);
  });
});
