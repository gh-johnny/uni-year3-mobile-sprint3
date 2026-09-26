import { aRecord, aVehicle, NOW } from '../__fixtures__/builders';
import { Percentage } from '../shared/percentage';
import { ServiceHistory } from '../service/service-history';
import { Vehicles } from '../vehicle/vehicles';
import { AgeBands } from './age-band';
import { AnomalyDetector } from './anomaly-detector';
import { ServiceShareCalculator, ShareSegment, TrendPoint } from './service-share-calculator';

const recent = new Date('2026-05-01T12:00:00.000Z');
const stale = new Date('2024-05-01T12:00:00.000Z');

const fleet = Vehicles.of([
  aVehicle({ id: 'v1', dealerId: 'd1', modelKey: 'ranger' }),
  aVehicle({ id: 'v2', dealerId: 'd1', modelKey: 'ranger' }),
  aVehicle({ id: 'v3', dealerId: 'd2', modelKey: 'territory', purchasedAt: new Date('2020-01-01'), warrantyEndsAt: new Date('2023-01-01') }),
  aVehicle({ id: 'v4', dealerId: 'd2', modelKey: 'maverick', purchasedAt: new Date('2026-02-01'), warrantyEndsAt: new Date('2029-02-01') }),
  aVehicle({ id: 'v7', dealerId: 'd3', modelKey: 'transit' }),
  // Out of park: sold in the future and too old.
  aVehicle({ id: 'v5', purchasedAt: new Date('2027-01-01'), warrantyEndsAt: new Date('2030-01-01') }),
  aVehicle({ id: 'v6', purchasedAt: new Date('2010-01-01'), warrantyEndsAt: new Date('2013-01-01') }),
]);

const history = ServiceHistory.of([
  aRecord({ vehicleId: 'v1', dealerId: 'd1', performedAt: recent }),
  aRecord({ vehicleId: 'v2', dealerId: null, type: 'oil', performedAt: recent }),
  aRecord({ vehicleId: 'v3', dealerId: 'd2', type: 'recall', performedAt: recent }),
  aRecord({ vehicleId: 'v3', dealerId: 'd2', type: 'oil', performedAt: stale }),
  aRecord({ vehicleId: 'v4', dealerId: 'd2', type: 'oil', performedAt: recent }),
  aRecord({ vehicleId: 'v6', dealerId: 'd1', type: 'oil', performedAt: recent }),
]);

describe('AgeBands', () => {
  it.each([
    [0.5, '0-1'],
    [2, '1-3'],
    [4, '3-5'],
    [6, '5-8'],
    [9, '8+'],
  ])('%p years → %p', (age, band) => {
    expect(AgeBands.of(age)).toBe(band);
  });
});

describe('ServiceShareCalculator', () => {
  const calculator = new ServiceShareCalculator();

  it('computes Service Share as paid network visits over the circulating park', () => {
    const snapshot = calculator.snapshot(fleet, history, NOW);
    expect(snapshot.park).toBe(5);
    expect(snapshot.retained).toBe(2);
    expect(snapshot.share.points).toBe(40);
    expect(snapshot.asOf).toBe(NOW);
  });

  it('breaks down by dealer and model (best first)', () => {
    const byDealer = calculator.breakdown('dealer', fleet, history, NOW);
    expect(byDealer.map((segment) => [segment.key, segment.numerator, segment.denominator])).toEqual([
      ['d1', 1, 2],
      ['d2', 1, 2],
      ['d3', 0, 1],
    ]);
    const byModel = calculator.breakdown('model', fleet, history, NOW);
    expect(byModel[0]?.key).toBe('maverick');
    expect(byModel[byModel.length - 1]?.key).toBe('transit');
  });

  it('keeps age bands in natural order', () => {
    const byAge = calculator.breakdown('age', fleet, history, NOW);
    expect(byAge.map((segment) => segment.key)).toEqual(['0-1', '1-3', '5-8']);
  });

  it('computes network capture per service type', () => {
    const byType = calculator.breakdown('serviceType', fleet, history, NOW);
    expect(byType.map((segment) => [segment.key, segment.numerator, segment.denominator])).toEqual([
      ['revision', 1, 1],
      ['recall', 1, 1],
      ['oil', 1, 2],
    ]);
  });

  it('builds a rolling monthly trend', () => {
    const trend = calculator.trend(fleet, history, NOW, 6);
    expect(trend).toHaveLength(6);
    expect(trend[5]?.share.points).toBe(40);
    expect(trend[0]?.month.getMonth()).toBe(3);
    expect(calculator.trend(fleet, history, NOW)).toHaveLength(12);
  });
});

describe('AnomalyDetector', () => {
  const segment = (key: string, points: number, denominator = 20): ShareSegment => ({
    key,
    share: Percentage.ofRatio(points / 100),
    numerator: Math.round((points / 100) * denominator),
    denominator,
  });
  const detector = new AnomalyDetector();

  it('flags segments far from the peer average', () => {
    const anomalies = detector.segments([
      segment('a', 60),
      segment('b', 62),
      segment('c', 58),
      segment('d', 61),
      segment('e', 59),
      segment('f', 30),
      segment('tiny', 5, 3),
    ]);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ key: 'f', direction: 'below' });
    expect(anomalies[0]?.zScore).toBeLessThan(-1.5);
    expect(anomalies[0]?.deltaPoints).toBeLessThan(-20);
  });

  it('reports outliers above the average too', () => {
    const anomalies = detector.segments([segment('a', 40), segment('b', 41), segment('c', 39), segment('d', 40), segment('e', 80)]);
    expect(anomalies[0]).toMatchObject({ key: 'e', direction: 'above' });
    const twoSided = new AnomalyDetector(1).segments([segment('a', 50), segment('b', 50), segment('c', 50), segment('d', 20), segment('e', 90)]);
    expect(twoSided.map((anomaly) => anomaly.key)).toEqual(['e', 'd']);
  });

  it('needs enough peers and variance', () => {
    expect(detector.segments([segment('a', 10), segment('b', 90)])).toEqual([]);
    expect(detector.segments([segment('a', 50), segment('b', 50), segment('c', 50)])).toEqual([]);
  });

  it('detects a break in the trend', () => {
    const point = (month: number, points: number): TrendPoint => ({ month: new Date(2026, month, 1), share: Percentage.ofRatio(points / 100) });
    const steady = [point(0, 60), point(1, 61), point(2, 60), point(3, 61), point(4, 60), point(5, 61)];
    expect(detector.trendBreak(steady)).toBeNull();
    const broken = [...steady, point(6, 50)];
    const anomaly = detector.trendBreak(broken);
    expect(anomaly?.deltaPoints).toBeCloseTo(-11);
    expect(anomaly?.month.getMonth()).toBe(6);
    expect(detector.trendBreak(steady.slice(0, 3))).toBeNull();
    expect(detector.trendBreak([point(0, 50), point(1, 50), point(2, 50), point(3, 40)])).toBeNull();
  });
});
