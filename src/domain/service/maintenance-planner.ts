import { Dates } from '../shared/clock';
import { Mileage } from '../vehicle/mileage';
import { Vehicle } from '../vehicle/vehicle';
import { ServiceHistory } from './service-history';

export type MaintenanceStatus = 'ok' | 'soon' | 'due' | 'overdue';

export type MaintenanceForecast = {
  status: MaintenanceStatus;
  /** 0 = just serviced, 1 = due now, >1 overdue. The worst of the km and time clocks. */
  wear: number;
  dueAt: Date;
  dueAtKm: number;
  kmRemaining: number;
  daysRemaining: number;
  lastServiceAt: Date;
  lastServiceKm: number;
};

/**
 * Predicts the next scheduled maintenance from two clocks — distance and time —
 * using the vehicle's own average monthly usage. Whichever clock expires first wins.
 */
export class MaintenancePlanner {
  static readonly SOON_THRESHOLD = 0.8;
  static readonly OVERDUE_THRESHOLD = 1.1;

  forecast(vehicle: Vehicle, history: ServiceHistory, now: Date): MaintenanceForecast {
    const { serviceIntervalKm, serviceIntervalMonths } = vehicle.model;
    const last = history.forVehicle(vehicle.id).lastMaintenance();
    const lastServiceAt = last?.performedAt ?? vehicle.purchasedAt;
    const lastServiceKm = last?.mileage ?? Mileage.zero();

    const kmSince = vehicle.mileage.since(lastServiceKm);
    const monthsSince = Math.max(0, Dates.monthsBetween(lastServiceAt, now));
    const wear = Math.max(kmSince / serviceIntervalKm, monthsSince / serviceIntervalMonths);

    const dueAtKm = lastServiceKm.km + serviceIntervalKm;
    const kmRemaining = dueAtKm - vehicle.mileage.km;
    const monthsUntilKm = vehicle.avgKmPerMonth > 0 ? kmRemaining / vehicle.avgKmPerMonth : Infinity;
    const monthsUntilTime = serviceIntervalMonths - monthsSince;
    const monthsUntilDue = Math.min(monthsUntilKm, monthsUntilTime);
    const dueAt = Dates.addDays(now, Math.round(monthsUntilDue * 30.4375));

    return {
      status: MaintenancePlanner.statusFor(wear),
      wear,
      dueAt,
      dueAtKm,
      kmRemaining,
      daysRemaining: Dates.daysBetween(now, dueAt),
      lastServiceAt,
      lastServiceKm: lastServiceKm.km,
    };
  }

  static statusFor(wear: number): MaintenanceStatus {
    if (wear >= MaintenancePlanner.OVERDUE_THRESHOLD) return 'overdue';
    if (wear >= 1) return 'due';
    if (wear >= MaintenancePlanner.SOON_THRESHOLD) return 'soon';
    return 'ok';
  }
}
