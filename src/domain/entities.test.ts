import { aCustomer, aDealer, aRecord, aVehicle, NOW, PAULISTA } from './__fixtures__/builders';
import { Role } from './auth/role';
import { User } from './auth/user';
import { Email } from './customer/email';
import { Dealers } from './dealer/dealers';
import { GeoPoint } from './geo/geo-point';
import { Money } from './shared/money';
import { MaintenancePlanner } from './service/maintenance-planner';
import { ServiceHistory } from './service/service-history';
import { ServiceTypes } from './service/service-type';
import { Mileage } from './vehicle/mileage';

describe('GeoPoint', () => {
  const ibirapuera = GeoPoint.restore(-23.5874, -46.6576);

  it('validates coordinates', () => {
    expect(GeoPoint.create(91, 0).error.code).toBe('geo.latitude');
    expect(GeoPoint.create(Number.NaN, 0).error.code).toBe('geo.latitude');
    expect(GeoPoint.create(0, 181).error.code).toBe('geo.longitude');
    expect(GeoPoint.create(0, 0).value.latitude).toBe(0);
    expect(() => GeoPoint.restore(100, 0)).toThrow();
  });

  it('measures Haversine distance and bearing', () => {
    expect(PAULISTA.distanceTo(ibirapuera)).toBeCloseTo(2.9, 1);
    expect(PAULISTA.distanceTo(PAULISTA)).toBe(0);
    expect(PAULISTA.bearingTo(ibirapuera)).toBeGreaterThan(170);
    expect(PAULISTA.bearingTo(ibirapuera)).toBeLessThan(190);
    expect(ibirapuera.bearingTo(PAULISTA)).toBeLessThan(10);
    expect(PAULISTA.longitude).toBe(-46.6559);
  });
});

describe('Email & Customer', () => {
  it('normalises and masks e-mails', () => {
    expect(Email.create('  Ana@Pitlane.App ').value.value).toBe('ana@pitlane.app');
    expect(Email.create('nope').error.code).toBe('email.invalid');
    expect(Email.restore('ana@pitlane.app').masked()).toBe('a•••@pitlane.app');
    expect(() => Email.restore('bad')).toThrow();
  });

  it('exposes customer helpers', () => {
    const customer = aCustomer({ name: 'Ana Paula Ribeiro', nps: 5 });
    expect(customer.firstName).toBe('Ana');
    expect(customer.name).toBe('Ana Paula Ribeiro');
    expect(customer.initials).toBe('AR');
    expect(customer.isDetractor()).toBe(true);
    expect(customer.maskedPhone()).toBe('+55 11 9••••-4321');
    expect(customer.email.value).toBe('ana@pitlane.app');
    expect(customer.phone).toBe('5511987654321');
    expect(customer.home).toBe(PAULISTA);
    expect(customer.marketingConsent).toBe(true);
    expect(customer.nps).toBe(5);
    expect(aCustomer({ name: 'Cher', nps: null }).initials).toBe('C');
    expect(aCustomer({ nps: null }).isDetractor()).toBe(false);
    expect(aCustomer({ nps: 7 }).isDetractor()).toBe(false);
    expect(aCustomer({ name: '' }).firstName).toBe('');
    expect(aCustomer({ name: '' }).initials).toBe('');
  });
});

describe('Role & User', () => {
  const base = {
    name: 'Carlos Mendes',
    email: Email.restore('carlos@pitlane.app'),
    passwordHash: 'h',
    salt: 's',
    customerId: null,
    dealerId: 'dlr-1',
  };

  it('grants permissions per role', () => {
    expect(Role.OWNER.can('appointment:book')).toBe(true);
    expect(Role.OWNER.can('leads:read')).toBe(false);
    expect(Role.ADVISOR.can('leads:contact')).toBe(true);
    expect(Role.from('advisor')).toBe(Role.ADVISOR);
    expect(Role.from('admin')).toBeUndefined();
  });

  it('enforces role-specific links', () => {
    expect(User.create('u', { ...base, role: Role.ADVISOR, dealerId: null }).error.code).toBe('user.advisorWithoutDealer');
    expect(User.create('u', { ...base, role: Role.OWNER }).error.code).toBe('user.ownerWithoutCustomer');
    const advisor = User.create('u', { ...base, role: Role.ADVISOR }).value;
    expect(advisor.firstName).toBe('Carlos');
    expect(advisor.name).toBe('Carlos Mendes');
    expect(advisor.email.value).toBe('carlos@pitlane.app');
    expect(advisor.role).toBe(Role.ADVISOR);
    expect(advisor.passwordHash).toBe('h');
    expect(advisor.salt).toBe('s');
    expect(advisor.dealerId).toBe('dlr-1');
    expect(advisor.customerId).toBeNull();
    expect(advisor.can('pulse:read')).toBe(true);
    const owner = User.create('o', { ...base, name: '', role: Role.OWNER, customerId: 'c' }).value;
    expect(owner.firstName).toBe('');
  });
});

describe('Dealer & Dealers', () => {
  const near = aDealer({ id: 'near', services: ['revision', 'oil'] });
  const far = aDealer({ id: 'far', location: GeoPoint.restore(-23.65, -46.53) });
  const dealers = Dealers.of([far, near]);

  it('exposes dealer details and rules', () => {
    expect(near.name).toBe('Ford Paulista');
    expect(near.city).toBe('São Paulo');
    expect(near.district).toBe('Bela Vista');
    expect(near.phone).toContain('+55');
    expect(near.rating).toBe(4.7);
    expect(near.bays).toBe(2);
    expect(near.opensAt).toBe(8);
    expect(near.closesAt).toBe(18);
    expect(near.services).toEqual(['revision', 'oil']);
    expect(near.offers('brakes')).toBe(false);
    expect(near.location).toBe(PAULISTA);
  });

  it('knows opening hours (Saturday half-day, Sunday closed)', () => {
    expect(near.isOpenAt(new Date(2026, 8, 25, 9))).toBe(true);
    expect(near.isOpenAt(new Date(2026, 8, 25, 19))).toBe(false);
    expect(near.isOpenAt(new Date(2026, 8, 26, 11))).toBe(true);
    expect(near.isOpenAt(new Date(2026, 8, 26, 13))).toBe(false);
    expect(near.isOpenAt(new Date(2026, 8, 27, 10))).toBe(false);
    expect(near.closingHourOn(6)).toBe(12);
    expect(near.closingHourOn(3)).toBe(18);
  });

  it('ranks by distance', () => {
    expect(dealers.byId('far')).toBe(far);
    expect(dealers.byId('x')).toBeUndefined();
    expect(dealers.offering('brakes').toArray()).toEqual([far]);
    const ranked = dealers.rankedByDistance(PAULISTA);
    expect(ranked.map((entry) => entry.dealer.id)).toEqual(['near', 'far']);
    expect(ranked[1]?.distanceKm).toBeGreaterThan(10);
    expect(ranked[1]?.bearing).toBeGreaterThan(90);
    expect(dealers.nearestTo(PAULISTA)?.dealer).toBe(near);
    expect(Dealers.of([]).nearestTo(PAULISTA)).toBeUndefined();
  });
});

describe('ServiceTypes & ServiceRecord', () => {
  it('exposes the service catalog', () => {
    expect(ServiceTypes.all()).toHaveLength(6);
    expect(ServiceTypes.get('recall').paid).toBe(false);
    expect(ServiceTypes.get('revision').durationMinutes).toBe(120);
    expect(ServiceTypes.get('oil').priceFactor).toBe(0.35);
    expect(ServiceTypes.isKey('oil')).toBe(true);
    expect(ServiceTypes.isKey('wash')).toBe(false);
    expect(() => ServiceTypes.get('wash' as never)).toThrow('serviceType.unknown');
  });

  it('classifies records', () => {
    const revision = aRecord({ type: 'revision' });
    expect(revision.isPaidNetworkVisit()).toBe(true);
    expect(revision.isMaintenance()).toBe(true);
    expect(aRecord({ type: 'recall' }).isPaidNetworkVisit()).toBe(false);
    expect(aRecord({ dealerId: null }).isPaidNetworkVisit()).toBe(false);
    expect(aRecord({ type: 'brakes' }).isMaintenance()).toBe(false);
    expect(revision.vehicleId).toBe('veh-1');
    expect(revision.dealerId).toBe('dlr-1');
    expect(revision.type).toBe('revision');
    expect(revision.mileage.km).toBe(15_000);
    expect(revision.amount.amount).toBe(1290);
    expect(revision.happenedWithin(new Date('2026-01-01'), new Date('2026-12-31'))).toBe(true);
    expect(revision.happenedWithin(new Date('2026-03-01T12:00:00.000Z'), new Date('2026-12-31'))).toBe(false);
  });
});

describe('ServiceHistory', () => {
  const oldOil = aRecord({ id: 'r1', type: 'oil', performedAt: new Date('2025-01-10'), mileage: Mileage.restore(5_000) });
  const outside = aRecord({ id: 'r2', type: 'brakes', dealerId: null, performedAt: new Date('2025-08-10') });
  const revision = aRecord({ id: 'r3', performedAt: new Date('2026-03-01'), amount: Money.brl(100) });
  const otherCar = aRecord({ id: 'r4', vehicleId: 'veh-2', performedAt: new Date('2026-06-01') });
  const history = ServiceHistory.of([oldOil, outside, revision, otherCar]);

  it('answers history questions', () => {
    expect(history.forVehicle('veh-1').size).toBe(3);
    expect(history.indexByVehicle().get('veh-2')?.size).toBe(1);
    expect(history.newestFirst().first()?.id).toBe('r4');
    expect(history.inNetwork().size).toBe(3);
    expect(history.outsideNetwork().first()?.id).toBe('r2');
    expect(history.within(new Date('2025-06-01'), new Date('2025-12-31')).size).toBe(1);
    expect(history.forVehicle('veh-1').lastMaintenance()?.id).toBe('r3');
    expect(history.forVehicle('veh-1').lastNetworkVisit()?.id).toBe('r3');
    expect(history.hasPaidNetworkVisitWithin(new Date('2026-01-01'), new Date('2026-04-01'))).toBe(true);
    expect(history.hasPaidNetworkVisitWithin(new Date('2025-06-01'), new Date('2025-12-31'))).toBe(false);
    expect(ServiceHistory.of([revision, otherCar]).totalSpent().amount).toBe(1390);
  });
});

describe('MaintenancePlanner', () => {
  const planner = new MaintenancePlanner();

  it('uses purchase date when there is no maintenance yet', () => {
    const vehicle = aVehicle({ id: 'fresh', mileage: Mileage.restore(2_000), purchasedAt: new Date('2026-06-25T12:00:00.000Z'), warrantyEndsAt: new Date('2029-06-25') });
    const forecast = planner.forecast(vehicle, ServiceHistory.of([]), NOW);
    expect(forecast.status).toBe('ok');
    expect(forecast.lastServiceKm).toBe(0);
    expect(forecast.dueAtKm).toBe(10_000);
    expect(forecast.kmRemaining).toBe(8_000);
    expect(forecast.daysRemaining).toBeGreaterThan(200);
    expect(forecast.lastServiceAt.toISOString()).toBe('2026-06-25T12:00:00.000Z');
  });

  it('flags the worst of the km and time clocks', () => {
    const vehicle = aVehicle({ id: 'car', mileage: Mileage.restore(24_500) });
    const history = ServiceHistory.of([aRecord({ vehicleId: 'car', mileage: Mileage.restore(15_000), performedAt: new Date('2026-03-01') })]);
    const forecast = planner.forecast(vehicle, history, NOW);
    expect(forecast.status).toBe('soon');
    expect(forecast.wear).toBeCloseTo(0.95);
    expect(forecast.kmRemaining).toBe(500);
  });

  it('handles parked vehicles (no usage) via the time clock', () => {
    const vehicle = aVehicle({ id: 'parked', avgKmPerMonth: 0, mileage: Mileage.restore(15_000) });
    const history = ServiceHistory.of([aRecord({ vehicleId: 'parked', performedAt: new Date('2025-06-01') })]);
    const forecast = planner.forecast(vehicle, history, NOW);
    expect(forecast.status).toBe('overdue');
    expect(forecast.daysRemaining).toBeLessThan(0);
  });

  it.each([
    [0.5, 'ok'],
    [0.8, 'soon'],
    [1, 'due'],
    [1.1, 'overdue'],
  ])('wear %p → %p', (wear, status) => {
    expect(MaintenancePlanner.statusFor(wear)).toBe(status);
  });
});
