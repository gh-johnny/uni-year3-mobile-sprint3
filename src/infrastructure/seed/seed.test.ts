import { MaintenancePlanner } from '@/domain/service/maintenance-planner';
import { ServiceHistory } from '@/domain/service/service-history';
import { TEST_NOW } from '@/test-utils/infrastructure';

import { DEALERS, MODELS } from './catalog';
import { DEMO_ADVISOR_EMAIL, DEMO_DEALER_ID, DEMO_OWNER_EMAIL, FleetGenerator } from './fleet-generator';
import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  it('is deterministic per seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(new SeededRandom(1).next()).not.toBe(new SeededRandom(2).next());
  });

  it('draws from the expected ranges and distributions', () => {
    const random = new SeededRandom(9);
    const samples = Array.from({ length: 2000 }, () => random.next());
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThan(1);
    expect(random.between(5, 6)).toBeGreaterThanOrEqual(5);
    const ints = Array.from({ length: 200 }, () => random.int(1, 3));
    expect(new Set(ints)).toEqual(new Set([1, 2, 3]));
    expect(random.chance(1)).toBe(true);
    expect(random.chance(0)).toBe(false);
    expect(['x', 'y']).toContain(random.pick(['x', 'y']));
    const normals = Array.from({ length: 3000 }, () => random.normal(10, 2));
    expect(normals.reduce((sum, value) => sum + value, 0) / normals.length).toBeCloseTo(10, 0);
    const exps = Array.from({ length: 3000 }, () => random.exponential(5));
    expect(exps.reduce((sum, value) => sum + value, 0) / exps.length).toBeGreaterThan(4);
  });

  it('respects weights, including the floating point fallback', () => {
    const random = new SeededRandom(3);
    const picks = Array.from({ length: 500 }, () => random.weighted([['a', 9], ['b', 1]] as const));
    expect(picks.filter((pick) => pick === 'a').length).toBeGreaterThan(400);
    const stuck = new SeededRandom(1);
    jest.spyOn(stuck, 'next').mockReturnValue(1);
    expect(stuck.weighted([['a', 1], ['b', 1]] as const)).toBe('b');
  });
});

describe('FleetGenerator', () => {
  const dataset = new FleetGenerator(2026, TEST_NOW, 200).generate();

  it('produces the whole dataset', () => {
    expect(dataset.dealers).toHaveLength(DEALERS.length);
    expect(dataset.vehicles).toHaveLength(202);
    expect(dataset.customers).toHaveLength(201);
    expect(dataset.records.length).toBeGreaterThan(600);
    expect(dataset.accounts.map((account) => account.email)).toEqual([DEMO_OWNER_EMAIL, DEMO_ADVISOR_EMAIL]);
    expect(dataset.leadStates.length).toBeGreaterThan(0);
    expect(dataset.appointments.length).toBeGreaterThan(0);
    expect(MODELS.map((model) => model.key)).toContain('ranger-raptor');
  });

  it('is deterministic for the same seed and anchor', () => {
    const again = new FleetGenerator(2026, TEST_NOW, 200).generate();
    expect(again.vehicles.map((vehicle) => vehicle.vin.value)).toEqual(dataset.vehicles.map((vehicle) => vehicle.vin.value));
    expect(again.records.length).toBe(dataset.records.length);
  });

  it('generates valid, unique Ford VINs and consistent odometers', () => {
    const vins = dataset.vehicles.map((vehicle) => vehicle.vin);
    expect(new Set(vins.map((vin) => vin.value)).size).toBe(vins.length);
    expect(vins.every((vin) => vin.isFord() && vin.hasValidCheckDigit())).toBe(true);
    const byId = new Map(dataset.vehicles.map((vehicle) => [vehicle.id, vehicle]));
    expect(dataset.records.every((record) => record.mileage.km <= (byId.get(record.vehicleId)?.mileage.km ?? 0))).toBe(true);
    expect(dataset.records.every((record) => record.performedAt <= TEST_NOW)).toBe(true);
  });

  it('models the demo personas for the storyline', () => {
    const planner = new MaintenancePlanner();
    const history = ServiceHistory.of(dataset.records);
    const raptor = dataset.vehicles.find((vehicle) => vehicle.id === 'veh-raptor');
    const territory = dataset.vehicles.find((vehicle) => vehicle.id === 'veh-territory');
    expect(raptor?.model.name).toBe('Ranger Raptor');
    expect(planner.forecast(raptor!, history, TEST_NOW).status).toBe('soon');
    expect(planner.forecast(territory!, history, TEST_NOW).status).toBe('overdue');
    expect(territory?.isUnderWarranty(TEST_NOW)).toBe(false);
    expect(dataset.accounts.find((account) => account.role === 'advisor')?.dealerId).toBe(DEMO_DEALER_ID);
  });

  it('keeps the network Service Share in a realistic band', () => {
    const history = ServiceHistory.of(dataset.records);
    const from = new Date(TEST_NOW.getTime() - 365 * 86_400_000);
    const retained = dataset.vehicles.filter((vehicle) => history.forVehicle(vehicle.id).hasPaidNetworkVisitWithin(from, TEST_NOW)).length;
    const share = retained / dataset.vehicles.length;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.8);
  });
});
