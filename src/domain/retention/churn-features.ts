import { Customer } from '../customer/customer';
import { Dealer } from '../dealer/dealer';
import { Dates } from '../shared/clock';
import { ServiceHistory } from '../service/service-history';
import { Vehicle } from '../vehicle/vehicle';

export const CHURN_FEATURES = [
  'monthsSinceService',
  'warrantyExpired',
  'vehicleAge',
  'overdue',
  'outsideVisits',
  'distance',
  'connected',
  'detractor',
] as const;

export type ChurnFeature = (typeof CHURN_FEATURES)[number];
export type ChurnFeatures = Readonly<Record<ChurnFeature, number>>;

const OUTSIDE_LOOKBACK_MONTHS = 24;
/** Caps keep a single extreme value from dominating the logit. */
const CAPS: Readonly<Partial<Record<ChurnFeature, number>>> = {
  monthsSinceService: 36,
  overdue: 3,
  outsideVisits: 4,
  distance: 60,
};

/**
 * Turns the 360° view of a vehicle (usage, history, warranty, customer sentiment,
 * dealer proximity) into the numeric feature vector the churn model consumes.
 */
export class ChurnFeatureExtractor {
  extract(params: {
    vehicle: Vehicle;
    history: ServiceHistory;
    customer: Customer;
    dealer: Dealer;
    now: Date;
  }): ChurnFeatures {
    const { vehicle, history, customer, dealer, now } = params;
    const own = history.forVehicle(vehicle.id);
    const lastNetwork = own.lastNetworkVisit();
    const referenceDate = lastNetwork?.performedAt ?? vehicle.purchasedAt;
    const referenceKm = lastNetwork?.mileage.km ?? 0;
    const outside = own.outsideNetwork().within(Dates.addMonths(now, -OUTSIDE_LOOKBACK_MONTHS), now).size;

    return ChurnFeatureExtractor.capped({
      monthsSinceService: Math.max(0, Dates.monthsBetween(referenceDate, now)),
      warrantyExpired: vehicle.isUnderWarranty(now) ? 0 : 1,
      vehicleAge: vehicle.ageInYears(now),
      overdue: Math.max(0, vehicle.mileage.km - referenceKm) / vehicle.model.serviceIntervalKm,
      outsideVisits: outside,
      distance: dealer.distanceFrom(customer.home),
      connected: vehicle.connected ? 1 : 0,
      detractor: customer.isDetractor() ? 1 : 0,
    });
  }

  static capped(features: ChurnFeatures): ChurnFeatures {
    const result = { ...features };
    for (const feature of CHURN_FEATURES) {
      const cap = CAPS[feature];
      if (cap !== undefined) result[feature] = Math.min(cap, result[feature]);
    }
    return Object.freeze(result);
  }
}
