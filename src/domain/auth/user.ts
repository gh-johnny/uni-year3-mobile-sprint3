import { Email } from '../customer/email';
import { Entity } from '../shared/entity';
import { Result } from '../shared/result';
import { Permission, Role } from './role';

export type UserProps = {
  name: string;
  email: Email;
  role: Role;
  passwordHash: string;
  salt: string;
  /** Set for owners — links the login to the customer record. */
  customerId: string | null;
  /** Set for advisors — the dealership they work for. */
  dealerId: string | null;
};

export class User extends Entity<UserProps> {
  private constructor(id: string, props: UserProps) {
    super(id, props);
  }

  static create(id: string, props: UserProps): Result<User> {
    if (props.role === Role.OWNER && !props.customerId) return Result.fail('user.ownerWithoutCustomer');
    if (props.role === Role.ADVISOR && !props.dealerId) return Result.fail('user.advisorWithoutDealer');
    return Result.ok(new User(id, { ...props }));
  }

  get name(): string {
    return this.props.name;
  }
  get firstName(): string {
    return this.props.name.split(' ')[0] as string;
  }
  get email(): Email {
    return this.props.email;
  }
  get role(): Role {
    return this.props.role;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get salt(): string {
    return this.props.salt;
  }
  get customerId(): string | null {
    return this.props.customerId;
  }
  get dealerId(): string | null {
    return this.props.dealerId;
  }

  can(permission: Permission): boolean {
    return this.props.role.can(permission);
  }
}
