import { Entity } from '../shared/entity';
import { GeoPoint } from '../geo/geo-point';
import { Email } from './email';

export type CustomerProps = {
  name: string;
  email: Email;
  phone: string;
  home: GeoPoint;
  /** LGPD: outreach is only allowed with explicit marketing consent. */
  marketingConsent: boolean;
  /** Last Net Promoter Score answer (0..10), if any. */
  nps: number | null;
};

export class Customer extends Entity<CustomerProps> {
  private constructor(id: string, props: CustomerProps) {
    super(id, props);
  }

  static restore(id: string, props: CustomerProps): Customer {
    return new Customer(id, { ...props });
  }

  get name(): string {
    return this.props.name;
  }
  get firstName(): string {
    return this.props.name.split(' ')[0] as string;
  }
  get initials(): string {
    const parts = this.props.name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1] as string)[0] : '';
    return `${first}${last}`.toUpperCase();
  }
  get email(): Email {
    return this.props.email;
  }
  get phone(): string {
    return this.props.phone;
  }
  get home(): GeoPoint {
    return this.props.home;
  }
  get marketingConsent(): boolean {
    return this.props.marketingConsent;
  }
  get nps(): number | null {
    return this.props.nps;
  }

  isDetractor(): boolean {
    return this.props.nps !== null && this.props.nps <= 6;
  }

  /** `+55 11 9••••-4321` */
  maskedPhone(): string {
    const digits = this.props.phone.replace(/\D/g, '');
    return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 5)}••••-${digits.slice(-4)}`;
  }
}
