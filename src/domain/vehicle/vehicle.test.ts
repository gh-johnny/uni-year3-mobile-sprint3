import { aVehicle, NOW } from '../__fixtures__/builders';
import { Mileage } from './mileage';
import { SPEC_FIELDS, SpecSheet } from './spec-sheet';
import { Vehicle } from './vehicle';
import { VehicleModels } from './vehicle-model';
import { Vehicles } from './vehicles';
import { Vin } from './vin';

describe('Vin', () => {
  it('validates length and characters (no I, O, Q)', () => {
    expect(Vin.create('123').error.code).toBe('vin.length');
    expect(Vin.create('1M8GDM9AXKP04278O').error.code).toBe('vin.characters');
    expect(Vin.create(' 1m8gdm9axkp-042788 ').value.value).toBe('1M8GDM9AXKP042788');
  });

  it('computes the ISO 3779 check digit', () => {
    expect(Vin.computeCheckDigit('1M8GDM9AXKP042788')).toBe('X');
    expect(Vin.create('1M8GDM9AXKP042788').value.hasValidCheckDigit()).toBe(true);
    expect(Vin.create('11111111111111111').value.hasValidCheckDigit()).toBe(true);
    expect(Vin.create('1M8GDM9A1KP042788').value.hasValidCheckDigit()).toBe(false);
    expect(Vin.withCheckDigit('9BFZB55P0R8012345').hasValidCheckDigit()).toBe(true);
  });

  it('identifies Ford manufacturers and assembly country', () => {
    const brazilian = Vin.withCheckDigit('9BFZB55P0R8012345');
    expect(brazilian.isFord()).toBe(true);
    expect(brazilian.assemblyCountry()).toBe('BR');
    expect(brazilian.wmi).toBe('9BF');
    expect(brazilian.serial).toBe('012345');
    const other = Vin.create('1M8GDM9AXKP042788').value;
    expect(other.isFord()).toBe(false);
    expect(other.assemblyCountry()).toBeNull();
  });

  it('decodes the model year within the right 30-year cycle', () => {
    expect(Vin.withCheckDigit('9BFZB55P0R8012345').modelYear(2026)).toBe(2024);
    expect(Vin.create('1M8GDM9AXKP042788').value.modelYear(2026)).toBe(2019);
    expect(Vin.create('1M8GDM9AXKP042788').value.modelYear(2000)).toBe(1989);
    expect(Vin.create('1M8GDM9AX0P042788').value.modelYear(2026)).toBeNull();
  });

  it('formats, stringifies and restores', () => {
    const vin = Vin.restore('1M8GDM9AXKP042788');
    expect(vin.formatted()).toBe('1M8 GDM9AX KP 042788');
    expect(`${vin}`).toBe('1M8GDM9AXKP042788');
    expect(() => Vin.restore('bad')).toThrow('vin.corrupted');
    expect(vin.equals(Vin.restore('1M8GDM9AXKP042788'))).toBe(true);
  });
});

describe('Mileage', () => {
  it('validates and does arithmetic', () => {
    expect(Mileage.create(-1).error.code).toBe('mileage.invalid');
    expect(Mileage.create(Number.NaN).error.code).toBe('mileage.invalid');
    expect(Mileage.create(3_000_000).error.code).toBe('mileage.tooHigh');
    expect(Mileage.create(10.6).value.km).toBe(11);
    expect(Mileage.zero().km).toBe(0);
    expect(Mileage.restore(100).add(50).km).toBe(150);
    expect(Mileage.restore(100).since(Mileage.restore(40))).toBe(60);
    expect(Mileage.restore(10).since(Mileage.restore(40))).toBe(0);
    expect(Mileage.restore(10).isAfter(Mileage.restore(5))).toBe(true);
  });
});

describe('SpecSheet & catalog', () => {
  it('always lists every field in the same order, with explicit gaps', () => {
    const sheet = SpecSheet.of({ engine: 'V6' });
    expect(sheet.entries().map((entry) => entry.field)).toEqual([...SPEC_FIELDS]);
    expect(sheet.get('engine')).toBe('V6');
    expect(sheet.get('torque')).toBeNull();
    expect(sheet.completeness()).toBeCloseTo(1 / SPEC_FIELDS.length);
  });

  it('delivers the full Ranger Raptor sheet from the kick-off slide', () => {
    const raptor = VehicleModels.get('ranger-raptor');
    expect(raptor.specs.completeness()).toBe(1);
    expect(raptor.specs.get('power')).toBe('397 cv @ 5650 rpm');
    expect(raptor.specs.get('torque')).toBe('583 Nm @ 3500 rpm');
    expect(raptor.specs.get('acceleration')).toContain('5,8 s');
    expect(raptor.name).toBe('Ranger Raptor');
    expect(raptor.segment).toBe('pickup');
    expect(raptor.powertrain).toBe('combustion');
  });

  it('exposes the catalog', () => {
    expect(VehicleModels.all()).toHaveLength(8);
    expect(VehicleModels.isKey('maverick')).toBe(true);
    expect(VehicleModels.isKey('fiesta')).toBe(false);
    expect(() => VehicleModels.get('fiesta' as never)).toThrow('vehicleModel.unknown');
    const machE = VehicleModels.get('mustang-mach-e');
    expect(machE.serviceIntervalMonths).toBe(24);
    expect(machE.annualServiceRevenue().amount).toBe(345);
  });
});

describe('Vehicle', () => {
  const base = aVehicle({ id: 'veh-a' }).snapshot();

  it('validates creation', () => {
    expect(Vehicle.create('v', base).isOk()).toBe(true);
    expect(Vehicle.create('v', { ...base, year: 1980 }).error.code).toBe('vehicle.year');
    expect(Vehicle.create('v', { ...base, year: 2030 }).error.code).toBe('vehicle.year');
    expect(Vehicle.create('v', { ...base, avgKmPerMonth: -1 }).error.code).toBe('vehicle.usage');
    expect(Vehicle.create('v', { ...base, warrantyEndsAt: new Date('2020-01-01') }).error.code).toBe('vehicle.warranty');
  });

  it('exposes its state', () => {
    const vehicle = aVehicle({ id: 'veh-a' });
    expect(vehicle.model.name).toBe('Ranger');
    expect(vehicle.modelKey).toBe('ranger');
    expect(vehicle.version).toBe('XLS 3.0');
    expect(vehicle.year).toBe(2024);
    expect(vehicle.color).toBe('Azul Belize');
    expect(vehicle.displayName).toBe('Ranger');
    expect(vehicle.nickname).toBeNull();
    expect(vehicle.customerId).toBe('cus-1');
    expect(vehicle.dealerId).toBe('dlr-1');
    expect(vehicle.avgKmPerMonth).toBe(1000);
    expect(vehicle.connected).toBe(true);
    expect(vehicle.vin.isFord()).toBe(true);
    expect(vehicle.purchasedAt.getFullYear()).toBe(2024);
    expect(vehicle.ageInYears(NOW)).toBeCloseTo(2.3, 1);
    expect(vehicle.ageInYears(new Date('2020-01-01'))).toBe(0);
    expect(vehicle.isUnderWarranty(NOW)).toBe(true);
    expect(vehicle.warrantyEndsAt.getFullYear()).toBe(2027);
    expect(vehicle.warrantyDaysLeft(NOW)).toBe(249);
    expect(vehicle.warrantyDaysLeft(new Date('2030-01-01'))).toBe(0);
  });

  it('only moves the odometer forward', () => {
    const vehicle = aVehicle();
    expect(vehicle.updateMileage(Mileage.restore(10)).error.code).toBe('vehicle.mileageBackwards');
    expect(vehicle.updateMileage(Mileage.restore(20_000)).isOk()).toBe(true);
    expect(vehicle.updateMileage(Mileage.restore(25_000)).isOk()).toBe(true);
    expect(vehicle.mileage.km).toBe(25_000);
  });

  it('renames with trimming and limits', () => {
    const vehicle = aVehicle();
    vehicle.rename('  Raptorzinha  ');
    expect(vehicle.displayName).toBe('Raptorzinha');
    vehicle.rename('x'.repeat(40));
    expect(vehicle.nickname).toHaveLength(24);
    vehicle.rename('   ');
    expect(vehicle.nickname).toBeNull();
    vehicle.rename(null);
    expect(vehicle.nickname).toBeNull();
  });
});

describe('Vehicles', () => {
  const old = aVehicle({ id: 'old', purchasedAt: new Date('2014-01-01'), warrantyEndsAt: new Date('2017-01-01'), dealerId: 'dlr-2' });
  const future = aVehicle({ id: 'future', purchasedAt: new Date('2027-01-01'), warrantyEndsAt: new Date('2030-01-01'), customerId: 'cus-2' });
  const current = aVehicle({ id: 'current' });
  const fleet = Vehicles.of([old, future, current]);

  it('queries the fleet', () => {
    expect(fleet.byId('current')).toBe(current);
    expect(fleet.byId('nope')).toBeUndefined();
    expect(fleet.ownedBy('cus-2').toArray()).toEqual([future]);
    expect(fleet.ofDealer('dlr-2').toArray()).toEqual([old]);
    expect(fleet.parkAt(NOW).toArray()).toEqual([current]);
  });
});
