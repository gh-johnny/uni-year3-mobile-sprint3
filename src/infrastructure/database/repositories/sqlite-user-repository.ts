import { UserRepository } from '@/application/ports/repositories';
import { Role } from '@/domain/auth/role';
import { User } from '@/domain/auth/user';
import { Email } from '@/domain/customer/email';
import { DomainError } from '@/domain/shared/domain-error';

import { SqlDatabase, SqlValue } from '../sql-database';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
  salt: string;
  customer_id: string | null;
  dealer_id: string | null;
};

export const UserMapper = {
  toDomain(row: UserRow): User {
    const role = Role.from(row.role);
    if (!role) throw DomainError.of('user.unknownRole', { role: row.role });
    return User.create(row.id, {
      name: row.name,
      email: Email.restore(row.email),
      role,
      passwordHash: row.password_hash,
      salt: row.salt,
      customerId: row.customer_id,
      dealerId: row.dealer_id,
    }).value;
  },

  toParams(user: User): SqlValue[] {
    return [user.id, user.name, user.email.value, user.role.key, user.passwordHash, user.salt, user.customerId, user.dealerId];
  },
} as const;

export const INSERT_USER = `INSERT OR REPLACE INTO users
  (id, name, email, role, password_hash, salt, customer_id, dealer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.first<UserRow>('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    return row ? UserMapper.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.first<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return row ? UserMapper.toDomain(row) : null;
  }
}
