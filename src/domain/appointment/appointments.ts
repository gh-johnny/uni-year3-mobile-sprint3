import { Collection } from '../shared/collection';
import { Appointment } from './appointment';

export class Appointments extends Collection<Appointment, Appointments> {
  static of(items: readonly Appointment[]): Appointments {
    return new Appointments(items);
  }

  protected create(items: readonly Appointment[]): Appointments {
    return new Appointments(items);
  }

  upcoming(now: Date): Appointments {
    return this.filter((appointment) => appointment.isUpcoming(now)).sortBy((a) => a.slot.start.getTime());
  }

  past(now: Date): Appointments {
    return this.filter((appointment) => !appointment.isUpcoming(now)).sortBy(
      (a) => a.slot.start.getTime(),
      'desc',
    );
  }

  next(now: Date): Appointment | undefined {
    return this.upcoming(now).first();
  }

  forVehicle(vehicleId: string): Appointments {
    return this.filter((appointment) => appointment.vehicleId === vehicleId);
  }

  active(): Appointments {
    return this.filter((appointment) => appointment.isActive());
  }
}
