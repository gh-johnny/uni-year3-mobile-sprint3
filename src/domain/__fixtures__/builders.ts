import { Customer, CustomerProps } from '../customer/customer';
import { Email } from '../customer/email';
import { Dealer, DealerProps } from '../dealer/dealer';
import { GeoPoint } from '../geo/geo-point';
import { Money } from '../shared/money';
import { ServiceRecord, ServiceRecordProps } from '../service/service-record';
import { SERVICE_TYPE_KEYS } from '../service/service-type';
import { Mileage } from '../vehicle/mileage';
import { Vehicle, VehicleProps } from '../vehicle/vehicle';
import { Vin } from '../vehicle/vin';

/** Test Data Builders — every test states only what matters to it. */
export const NOW = new Date('2026-09-25T12:00:00.000Z');
export const PAULISTA = GeoPoint.restore(-23.5614, -46.6559);

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

export const aVehicle = (overrides: Partial<VehicleProps> & { id?: string } = {}): Vehicle => {
  const { id = nextId('veh'), ...props } = overrides;
  return Vehicle.restore(id, {
    vin: Vin.withCheckDigit('9BFZB55P0R8012345'),
    modelKey: 'ranger',
    version: 'XLS 3.0',
    year: 2024,
    color: 'Azul Belize',
    nickname: null,
    customerId: 'cus-1',
    dealerId: 'dlr-1',
    mileage: Mileage.restore(20_000),
    avgKmPerMonth: 1_000,
    purchasedAt: new Date('2024-06-01T12:00:00.000Z'),
    warrantyEndsAt: new Date('2027-06-01T12:00:00.000Z'),
    connected: true,
    ...props,
  });
};

export const aDealer = (overrides: Partial<DealerProps> & { id?: string } = {}): Dealer => {
  const { id = nextId('dlr'), ...props } = overrides;
  return Dealer.restore(id, {
    name: 'Ford Paulista',
    city: 'São Paulo',
    district: 'Bela Vista',
    location: PAULISTA,
    phone: '+55 11 3000-0000',
    rating: 4.7,
    bays: 2,
    opensAt: 8,
    closesAt: 18,
    services: SERVICE_TYPE_KEYS,
    ...props,
  });
};

export const aCustomer = (overrides: Partial<CustomerProps> & { id?: string } = {}): Customer => {
  const { id = nextId('cus'), ...props } = overrides;
  return Customer.restore(id, {
    name: 'Ana Ribeiro',
    email: Email.restore('ana@pitlane.app'),
    phone: '5511987654321',
    home: PAULISTA,
    marketingConsent: true,
    nps: 9,
    ...props,
  });
};

export const aRecord = (overrides: Partial<ServiceRecordProps> & { id?: string } = {}): ServiceRecord => {
  const { id = nextId('rec'), ...props } = overrides;
  return ServiceRecord.restore(id, {
    vehicleId: 'veh-1',
    dealerId: 'dlr-1',
    type: 'revision',
    performedAt: new Date('2026-03-01T12:00:00.000Z'),
    mileage: Mileage.restore(15_000),
    amount: Money.brl(1290),
    ...props,
  });
};

export const daysFrom = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
