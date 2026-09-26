import { Collection } from '../shared/collection';
import { Money } from '../shared/money';
import { ServiceRecord } from './service-record';

export class ServiceHistory extends Collection<ServiceRecord, ServiceHistory> {
  static of(items: readonly ServiceRecord[]): ServiceHistory {
    return new ServiceHistory(items);
  }

  protected create(items: readonly ServiceRecord[]): ServiceHistory {
    return new ServiceHistory(items);
  }

  forVehicle(vehicleId: string): ServiceHistory {
    return this.filter((record) => record.vehicleId === vehicleId);
  }

  /** Index by vehicle — O(n) once instead of O(n·m) scans in analytics loops. */
  indexByVehicle(): Map<string, ServiceHistory> {
    return this.groupBy((record) => record.vehicleId);
  }

  newestFirst(): ServiceHistory {
    return this.sortBy((record) => record.performedAt.getTime(), 'desc');
  }

  inNetwork(): ServiceHistory {
    return this.filter((record) => record.isInNetwork());
  }

  outsideNetwork(): ServiceHistory {
    return this.filter((record) => !record.isInNetwork());
  }

  within(from: Date, to: Date): ServiceHistory {
    return this.filter((record) => record.happenedWithin(from, to));
  }

  lastMaintenance(): ServiceRecord | undefined {
    return this.filter((record) => record.isMaintenance()).newestFirst().first();
  }

  lastNetworkVisit(): ServiceRecord | undefined {
    return this.inNetwork().newestFirst().first();
  }

  hasPaidNetworkVisitWithin(from: Date, to: Date): boolean {
    return this.some((record) => record.isPaidNetworkVisit() && record.happenedWithin(from, to));
  }

  totalSpent(): Money {
    return this.items.reduce((total, record) => total.add(record.amount), Money.zero());
  }
}
