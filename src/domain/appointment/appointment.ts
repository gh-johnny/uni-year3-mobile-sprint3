import { Entity } from '../shared/entity';
import { Money } from '../shared/money';
import { Result } from '../shared/result';
import { ServiceTypeKey } from '../service/service-type';
import { TimeSlot } from './time-slot';

export type AppointmentStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled';

export type AppointmentProps = {
  vehicleId: string;
  customerId: string;
  dealerId: string;
  serviceType: ServiceTypeKey;
  slot: TimeSlot;
  status: AppointmentStatus;
  checkInCode: string;
  estimate: Money;
  notes: string | null;
  createdAt: Date;
};

/** Legal transitions of the appointment state machine. */
const TRANSITIONS: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  scheduled: ['checked_in', 'cancelled'],
  checked_in: ['completed'],
  completed: [],
  cancelled: [],
};

/** Cancelling closer than this to the slot is not allowed (dealer already allocated the bay). */
export const CANCELLATION_WINDOW_HOURS = 2;

export class Appointment extends Entity<AppointmentProps> {
  private constructor(id: string, props: AppointmentProps) {
    super(id, props);
  }

  /** Used by `AppointmentBuilder` (validation lives there) and repositories. */
  static restore(id: string, props: AppointmentProps): Appointment {
    return new Appointment(id, { ...props });
  }

  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get dealerId(): string {
    return this.props.dealerId;
  }
  get serviceType(): ServiceTypeKey {
    return this.props.serviceType;
  }
  get slot(): TimeSlot {
    return this.props.slot;
  }
  get status(): AppointmentStatus {
    return this.props.status;
  }
  get checkInCode(): string {
    return this.props.checkInCode;
  }
  get estimate(): Money {
    return this.props.estimate;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  isActive(): boolean {
    return this.props.status === 'scheduled' || this.props.status === 'checked_in';
  }

  isUpcoming(now: Date): boolean {
    return this.isActive() && this.props.slot.end > now;
  }

  canCancel(now: Date): boolean {
    const hoursUntil = (this.props.slot.start.getTime() - now.getTime()) / 3_600_000;
    return this.props.status === 'scheduled' && hoursUntil >= CANCELLATION_WINDOW_HOURS;
  }

  cancel(now: Date): Result<void> {
    if (this.props.status !== 'scheduled') return this.transition('cancelled');
    if (!this.canCancel(now)) return Result.fail('appointment.tooLateToCancel');
    return this.transition('cancelled');
  }

  checkIn(): Result<void> {
    return this.transition('checked_in');
  }

  complete(): Result<void> {
    return this.transition('completed');
  }

  private transition(to: AppointmentStatus): Result<void> {
    if (!TRANSITIONS[this.props.status].includes(to)) {
      return Result.fail('appointment.invalidTransition', { from: this.props.status, to });
    }
    this.props.status = to;
    return Result.ok();
  }
}
