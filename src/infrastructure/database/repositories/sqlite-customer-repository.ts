import { CustomerRepository } from '@/application/ports/repositories';
import { Customer } from '@/domain/customer/customer';
import { Email } from '@/domain/customer/email';
import { GeoPoint } from '@/domain/geo/geo-point';

import { SqlBool, SqlDatabase, SqlValue } from '../sql-database';

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  home_lat: number;
  home_lng: number;
  marketing_consent: number;
  nps: number | null;
};

export const CustomerMapper = {
  toDomain(row: CustomerRow): Customer {
    return Customer.restore(row.id, {
      name: row.name,
      email: Email.restore(row.email),
      phone: row.phone,
      home: GeoPoint.restore(row.home_lat, row.home_lng),
      marketingConsent: SqlBool.from(row.marketing_consent),
      nps: row.nps,
    });
  },

  toParams(customer: Customer): SqlValue[] {
    return [
      customer.id,
      customer.name,
      customer.email.value,
      customer.phone,
      customer.home.latitude,
      customer.home.longitude,
      SqlBool.to(customer.marketingConsent),
      customer.nps,
    ];
  },
} as const;

export const INSERT_CUSTOMER_COLUMNS = '(id, name, email, phone, home_lat, home_lng, marketing_consent, nps)';

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: string): Promise<Customer | null> {
    const row = await this.db.first<CustomerRow>('SELECT * FROM customers WHERE id = ?', [id]);
    return row ? CustomerMapper.toDomain(row) : null;
  }

  async all(): Promise<Customer[]> {
    const rows = await this.db.all<CustomerRow>('SELECT * FROM customers');
    return rows.map(CustomerMapper.toDomain);
  }
}
