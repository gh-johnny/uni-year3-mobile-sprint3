import { VehicleRepository } from '@/application/ports/repositories';
import { Mileage } from '@/domain/vehicle/mileage';
import { Vehicle } from '@/domain/vehicle/vehicle';
import { VehicleModelKey } from '@/domain/vehicle/vehicle-model';
import { Vehicles } from '@/domain/vehicle/vehicles';
import { Vin } from '@/domain/vehicle/vin';

import { SqlBool, SqlDatabase, SqlValue } from '../sql-database';

export type VehicleRow = {
  id: string;
  vin: string;
  model_key: string;
  version: string;
  year: number;
  color: string;
  nickname: string | null;
  customer_id: string;
  dealer_id: string;
  mileage_km: number;
  avg_km_month: number;
  purchased_at: string;
  warranty_ends_at: string;
  connected: number;
};

export const VehicleMapper = {
  columns: [
    'id', 'vin', 'model_key', 'version', 'year', 'color', 'nickname', 'customer_id', 'dealer_id',
    'mileage_km', 'avg_km_month', 'purchased_at', 'warranty_ends_at', 'connected',
  ] as const,

  toDomain(row: VehicleRow): Vehicle {
    return Vehicle.restore(row.id, {
      vin: Vin.restore(row.vin),
      modelKey: row.model_key as VehicleModelKey,
      version: row.version,
      year: row.year,
      color: row.color,
      nickname: row.nickname,
      customerId: row.customer_id,
      dealerId: row.dealer_id,
      mileage: Mileage.restore(row.mileage_km),
      avgKmPerMonth: row.avg_km_month,
      purchasedAt: new Date(row.purchased_at),
      warrantyEndsAt: new Date(row.warranty_ends_at),
      connected: SqlBool.from(row.connected),
    });
  },

  toParams(vehicle: Vehicle): SqlValue[] {
    return [
      vehicle.id,
      vehicle.vin.value,
      vehicle.modelKey,
      vehicle.version,
      vehicle.year,
      vehicle.color,
      vehicle.nickname,
      vehicle.customerId,
      vehicle.dealerId,
      vehicle.mileage.km,
      Math.round(vehicle.avgKmPerMonth),
      vehicle.purchasedAt.toISOString(),
      vehicle.warrantyEndsAt.toISOString(),
      SqlBool.to(vehicle.connected),
    ];
  },
} as const;

const UPSERT = `INSERT OR REPLACE INTO vehicles (${VehicleMapper.columns.join(', ')})
  VALUES (${VehicleMapper.columns.map(() => '?').join(', ')})`;

export class SqliteVehicleRepository implements VehicleRepository {
  constructor(private readonly db: SqlDatabase) {}

  async all(): Promise<Vehicles> {
    const rows = await this.db.all<VehicleRow>('SELECT * FROM vehicles');
    return Vehicles.of(rows.map(VehicleMapper.toDomain));
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.db.first<VehicleRow>('SELECT * FROM vehicles WHERE id = ?', [id]);
    return row ? VehicleMapper.toDomain(row) : null;
  }

  async findByVin(vin: string): Promise<Vehicle | null> {
    const row = await this.db.first<VehicleRow>('SELECT * FROM vehicles WHERE vin = ?', [vin]);
    return row ? VehicleMapper.toDomain(row) : null;
  }

  async ownedBy(customerId: string): Promise<Vehicles> {
    const rows = await this.db.all<VehicleRow>(
      'SELECT * FROM vehicles WHERE customer_id = ? ORDER BY purchased_at DESC',
      [customerId],
    );
    return Vehicles.of(rows.map(VehicleMapper.toDomain));
  }

  async save(vehicle: Vehicle): Promise<void> {
    await this.db.run(UPSERT, VehicleMapper.toParams(vehicle));
  }
}
