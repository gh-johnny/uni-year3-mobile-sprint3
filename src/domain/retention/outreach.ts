import { Entity } from '../shared/entity';
import { NextBestActionKey, OutreachChannel } from './next-best-action';

export type OutreachProps = {
  vehicleId: string;
  advisorId: string;
  channel: OutreachChannel;
  action: NextBestActionKey;
  discount: number;
  createdAt: Date;
};

/** A contact attempt logged by an advisor — the unit of work that gets synced upstream. */
export class Outreach extends Entity<OutreachProps> {
  private constructor(id: string, props: OutreachProps) {
    super(id, props);
  }

  static restore(id: string, props: OutreachProps): Outreach {
    return new Outreach(id, { ...props });
  }

  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get advisorId(): string {
    return this.props.advisorId;
  }
  get channel(): OutreachChannel {
    return this.props.channel;
  }
  get action(): NextBestActionKey {
    return this.props.action;
  }
  get discount(): number {
    return this.props.discount;
  }
  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }
}
