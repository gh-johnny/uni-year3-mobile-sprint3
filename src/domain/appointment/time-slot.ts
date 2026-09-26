import { Result } from '../shared/result';
import { ValueObject } from '../shared/value-object';

type TimeSlotProps = { start: Date; minutes: number };

export class TimeSlot extends ValueObject<TimeSlotProps> {
  private constructor(props: TimeSlotProps) {
    super(props);
  }

  static create(start: Date, minutes: number): Result<TimeSlot> {
    if (Number.isNaN(start.getTime())) return Result.fail('slot.invalidStart');
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 8 * 60) return Result.fail('slot.invalidDuration');
    return Result.ok(new TimeSlot({ start: new Date(start), minutes }));
  }

  static restore(start: Date, minutes: number): TimeSlot {
    return TimeSlot.create(start, minutes).value;
  }

  get start(): Date {
    return new Date(this.props.start);
  }

  get minutes(): number {
    return this.props.minutes;
  }

  get end(): Date {
    return new Date(this.props.start.getTime() + this.props.minutes * 60_000);
  }

  overlaps(other: TimeSlot): boolean {
    return this.start < other.end && other.start < this.end;
  }

  isBefore(date: Date): boolean {
    return this.props.start.getTime() < date.getTime();
  }
}
