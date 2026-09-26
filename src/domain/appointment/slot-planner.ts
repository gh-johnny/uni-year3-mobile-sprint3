import { Dealer } from '../dealer/dealer';
import { Dates } from '../shared/clock';
import { Appointments } from './appointments';
import { TimeSlot } from './time-slot';

export type SlotAvailability = { slot: TimeSlot; freeBays: number };

/**
 * Generates bookable slots for a dealer on a given day, respecting opening hours,
 * lunch break, Saturday half-day, bay capacity and a minimum lead time.
 */
export class SlotPlanner {
  static readonly STEP_MINUTES = 30;
  static readonly LUNCH = { from: 12, to: 13 } as const;
  static readonly MIN_LEAD_MINUTES = 60;

  availability(params: {
    dealer: Dealer;
    day: Date;
    durationMinutes: number;
    booked: Appointments;
    now: Date;
  }): SlotAvailability[] {
    const { dealer, day, durationMinutes, booked, now } = params;
    const weekday = day.getDay();
    if (weekday === 0) return [];

    const dayStart = Dates.startOfDay(day);
    const closing = dealer.closingHourOn(weekday);
    const earliest = now.getTime() + SlotPlanner.MIN_LEAD_MINUTES * 60_000;
    const sameDayBookings = booked
      .active()
      .filter((appointment) => appointment.dealerId === dealer.id && Dates.isSameDay(appointment.slot.start, day));

    const result: SlotAvailability[] = [];
    for (let minutes = dealer.opensAt * 60; minutes + durationMinutes <= closing * 60; minutes += SlotPlanner.STEP_MINUTES) {
      if (SlotPlanner.crossesLunch(minutes, durationMinutes)) continue;
      const slot = TimeSlot.restore(new Date(dayStart.getTime() + minutes * 60_000), durationMinutes);
      if (slot.start.getTime() < earliest) continue;
      const occupied = sameDayBookings.count((appointment) => appointment.slot.overlaps(slot));
      const freeBays = dealer.bays - occupied;
      if (freeBays > 0) result.push({ slot, freeBays });
    }
    return result;
  }

  /** Next `count` open days (skipping Sundays), starting today. */
  upcomingDays(from: Date, count: number): Date[] {
    const days: Date[] = [];
    let cursor = Dates.startOfDay(from);
    while (days.length < count) {
      if (cursor.getDay() !== 0) days.push(cursor);
      cursor = Dates.addDays(cursor, 1);
    }
    return days;
  }

  private static crossesLunch(startMinutes: number, durationMinutes: number): boolean {
    const lunchStart = SlotPlanner.LUNCH.from * 60;
    const lunchEnd = SlotPlanner.LUNCH.to * 60;
    return startMinutes < lunchEnd && startMinutes + durationMinutes > lunchStart;
  }
}
