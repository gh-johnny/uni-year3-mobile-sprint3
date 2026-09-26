import { DealerRepository } from '@/application/ports/repositories';
import { Dealer } from '@/domain/dealer/dealer';
import { Dealers } from '@/domain/dealer/dealers';
import { GeoPoint } from '@/domain/geo/geo-point';
import { ServiceTypeKey } from '@/domain/service/service-type';

import { SqlDatabase, SqlValue } from '../sql-database';

export type DealerRow = {
  id: string;
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number;
  bays: number;
  opens_at: number;
  closes_at: number;
  services: string;
};

export const DealerMapper = {
  toDomain(row: DealerRow): Dealer {
    return Dealer.restore(row.id, {
      name: row.name,
      city: row.city,
      district: row.district,
      location: GeoPoint.restore(row.lat, row.lng),
      phone: row.phone,
      rating: row.rating,
      bays: row.bays,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      services: row.services.split(',') as ServiceTypeKey[],
    });
  },

  toParams(dealer: Dealer): SqlValue[] {
    return [
      dealer.id,
      dealer.name,
      dealer.city,
      dealer.district,
      dealer.location.latitude,
      dealer.location.longitude,
      dealer.phone,
      dealer.rating,
      dealer.bays,
      dealer.opensAt,
      dealer.closesAt,
      dealer.services.join(','),
    ];
  },
} as const;

export const INSERT_DEALER = `INSERT OR REPLACE INTO dealers
  (id, name, city, district, lat, lng, phone, rating, bays, opens_at, closes_at, services)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export class SqliteDealerRepository implements DealerRepository {
  constructor(private readonly db: SqlDatabase) {}

  async all(): Promise<Dealers> {
    const rows = await this.db.all<DealerRow>('SELECT * FROM dealers ORDER BY name');
    return Dealers.of(rows.map(DealerMapper.toDomain));
  }

  async findById(id: string): Promise<Dealer | null> {
    const row = await this.db.first<DealerRow>('SELECT * FROM dealers WHERE id = ?', [id]);
    return row ? DealerMapper.toDomain(row) : null;
  }
}
