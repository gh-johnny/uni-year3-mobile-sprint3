import { Dates } from '../shared/clock';
import { ServiceTypeKey } from '../service/service-type';
import { ServiceHistory } from '../service/service-history';
import { MaintenanceForecast } from '../service/maintenance-planner';
import { Vehicle } from '../vehicle/vehicle';

export type OfferKind = 'revisionDue' | 'warrantyEnding' | 'tireCheck' | 'loyaltyReward' | 'welcomeBack';

export type Offer = {
  id: string;
  kind: OfferKind;
  vehicleId: string;
  serviceType: ServiceTypeKey;
  discount: number;
  validUntil: Date;
};

type Rule = (context: OfferContext) => Omit<Offer, 'id' | 'vehicleId' | 'validUntil'> | null;
type OfferContext = { vehicle: Vehicle; history: ServiceHistory; forecast: MaintenanceForecast; now: Date };

const TIRE_CHECK_EVERY_KM = 40_000;
const WARRANTY_HORIZON_DAYS = 120;

/**
 * Rule-based personalisation for owners: each rule looks at the vehicle's 360° state
 * and may emit an offer. Keeps the "customer journey" pillar of the challenge.
 */
export class OfferEngine {
  private static readonly rules: readonly Rule[] = [
    ({ forecast }) =>
      forecast.status !== 'ok' ? { kind: 'revisionDue', serviceType: 'revision', discount: 0.1 } : null,
    ({ vehicle, now }) => {
      const days = vehicle.warrantyDaysLeft(now);
      return days > 0 && days <= WARRANTY_HORIZON_DAYS
        ? { kind: 'warrantyEnding', serviceType: 'diagnostics', discount: 1 }
        : null;
    },
    ({ vehicle, history }) => {
      const lastTires = history.forVehicle(vehicle.id).filter((record) => record.type === 'tires').newestFirst().first();
      const since = vehicle.mileage.km - (lastTires?.mileage.km ?? 0);
      return since >= TIRE_CHECK_EVERY_KM ? { kind: 'tireCheck', serviceType: 'tires', discount: 0.15 } : null;
    },
    ({ vehicle, history }) => {
      const own = history.forVehicle(vehicle.id);
      if (own.outsideNetwork().size > 0) return { kind: 'welcomeBack', serviceType: 'revision', discount: 0.2 };
      return own.inNetwork().size >= 3 ? { kind: 'loyaltyReward', serviceType: 'oil', discount: 0.25 } : null;
    },
  ];

  forVehicle(context: OfferContext): Offer[] {
    const validUntil = Dates.addDays(context.now, 30);
    return OfferEngine.rules
      .map((rule) => rule(context))
      .filter((offer): offer is NonNullable<ReturnType<Rule>> => offer !== null)
      .map((offer) => ({ ...offer, id: `${offer.kind}-${context.vehicle.id}`, vehicleId: context.vehicle.id, validUntil }));
  }
}
