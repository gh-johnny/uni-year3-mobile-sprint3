import { aRecord, aVehicle, NOW } from '../__fixtures__/builders';
import { MaintenancePlanner } from '../service/maintenance-planner';
import { ServiceHistory } from '../service/service-history';
import { Mileage } from '../vehicle/mileage';
import { OfferEngine } from './offer-engine';

const engine = new OfferEngine();
const planner = new MaintenancePlanner();

const offersFor = (vehicle: ReturnType<typeof aVehicle>, history: ServiceHistory) =>
  engine.forVehicle({ vehicle, history, forecast: planner.forecast(vehicle, history, NOW), now: NOW });

describe('OfferEngine', () => {
  it('offers nothing to a freshly serviced vehicle', () => {
    const vehicle = aVehicle({ id: 'v', mileage: Mileage.restore(16_000) });
    const history = ServiceHistory.of([aRecord({ vehicleId: 'v', performedAt: new Date('2026-08-01') })]);
    expect(offersFor(vehicle, history)).toEqual([]);
  });

  it('personalises offers from the vehicle state', () => {
    const vehicle = aVehicle({
      id: 'v',
      mileage: Mileage.restore(48_000),
      warrantyEndsAt: new Date('2026-11-01T12:00:00.000Z'),
    });
    const history = ServiceHistory.of([
      aRecord({ vehicleId: 'v', performedAt: new Date('2025-06-01'), mileage: Mileage.restore(30_000) }),
      aRecord({ vehicleId: 'v', dealerId: null, type: 'oil', performedAt: new Date('2026-01-01') }),
    ]);
    const offers = offersFor(vehicle, history);
    expect(offers.map((offer) => offer.kind)).toEqual(['revisionDue', 'warrantyEnding', 'tireCheck', 'welcomeBack']);
    expect(offers[0]).toMatchObject({ id: 'revisionDue-v', vehicleId: 'v', serviceType: 'revision', discount: 0.1 });
    expect(offers[0]?.validUntil.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('rewards loyal customers and checks tyres since the last tyre job', () => {
    const vehicle = aVehicle({ id: 'v', mileage: Mileage.restore(60_000) });
    const history = ServiceHistory.of([
      aRecord({ vehicleId: 'v', type: 'tires', mileage: Mileage.restore(50_000), performedAt: new Date('2025-01-01') }),
      aRecord({ vehicleId: 'v', type: 'oil', mileage: Mileage.restore(55_000), performedAt: new Date('2025-09-01') }),
      aRecord({ vehicleId: 'v', mileage: Mileage.restore(59_000), performedAt: new Date('2026-09-01') }),
    ]);
    expect(offersFor(vehicle, history).map((offer) => offer.kind)).toEqual(['loyaltyReward']);
  });
});
