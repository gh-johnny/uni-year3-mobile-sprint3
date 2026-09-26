import { ServiceRecordRepository } from '@/application/ports/repositories';
import { Money } from '@/domain/shared/money';
import { ServiceHistory } from '@/domain/service/service-history';
import { ServiceRecord } from '@/domain/service/service-record';
import { ServiceTypeKey } from '@/domain/service/service-type';
import { Mileage } from '@/domain/vehicle/mileage';

import { placeholders, SqlDatabase, SqlValue } from '../sql-database';

export type ServiceRecordRow = {
  id: string;
  vehicle_id: string;
  dealer_id: string | null;
  type: string;
  performed_at: string;
  mileage_km: number;
  amount_cents: number;
};

export const ServiceRecordMapper = {
  toDomain(row: ServiceRecordRow): ServiceRecord {
    return ServiceRecord.restore(row.id, {
      vehicleId: row.vehicle_id,
      dealerId: row.dealer_id,
      type: row.type as ServiceTypeKey,
      performedAt: new Date(row.performed_at),
      mileage: Mileage.restore(row.mileage_km),
      amount: Money.fromCents(row.amount_cents).value,
    });
  },

  toParams(record: ServiceRecord): SqlValue[] {
    return [
      record.id,
      record.vehicleId,
      record.dealerId,
      record.type,
      record.performedAt.toISOString(),
      record.mileage.km,
      record.amount.cents,
    ];
  },
} as const;

export const INSERT_RECORD_COLUMNS = '(id, vehicle_id, dealer_id, type, performed_at, mileage_km, amount_cents)';

export class SqliteServiceRecordRepository implements ServiceRecordRepository {
  constructor(private readonly db: SqlDatabase) {}

  async all(): Promise<ServiceHistory> {
    const rows = await this.db.all<ServiceRecordRow>('SELECT * FROM service_records');
    return ServiceHistory.of(rows.map(ServiceRecordMapper.toDomain));
  }

  async forVehicles(vehicleIds: readonly string[]): Promise<ServiceHistory> {
    if (vehicleIds.length === 0) return ServiceHistory.of([]);
    const rows = await this.db.all<ServiceRecordRow>(
      `SELECT * FROM service_records WHERE vehicle_id IN (${placeholders(vehicleIds.length)}) ORDER BY performed_at DESC`,
      vehicleIds,
    );
    return ServiceHistory.of(rows.map(ServiceRecordMapper.toDomain));
  }
}
