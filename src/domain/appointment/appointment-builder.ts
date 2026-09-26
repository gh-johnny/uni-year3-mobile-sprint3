import { Dealer } from '../dealer/dealer';
import { Money } from '../shared/money';
import { Result } from '../shared/result';
import { ServiceTypeKey, ServiceTypes } from '../service/service-type';
import { Vehicle } from '../vehicle/vehicle';
import { Appointment } from './appointment';
import { TimeSlot } from './time-slot';

/**
 * Builder for new appointments. Collects the pieces of the booking wizard step by
 * step and enforces every invariant in one place (`build`).
 */
export class AppointmentBuilder {
  private vehicle?: Vehicle;
  private dealer?: Dealer;
  private serviceType?: ServiceTypeKey;
  private start?: Date;
  private note: string | null = null;

  static create(): AppointmentBuilder {
    return new AppointmentBuilder();
  }

  forVehicle(vehicle: Vehicle): this {
    this.vehicle = vehicle;
    return this;
  }

  atDealer(dealer: Dealer): this {
    this.dealer = dealer;
    return this;
  }

  ofType(serviceType: ServiceTypeKey): this {
    this.serviceType = serviceType;
    return this;
  }

  startingAt(start: Date): this {
    this.start = start;
    return this;
  }

  withNotes(notes: string | null | undefined): this {
    const trimmed = notes?.trim() ?? '';
    this.note = trimmed.length > 0 ? trimmed.slice(0, 280) : null;
    return this;
  }

  build(params: { id: string; checkInCode: string; now: Date }): Result<Appointment> {
    const { vehicle, dealer, serviceType, start } = this;
    if (!vehicle) return Result.fail('booking.vehicleRequired');
    if (!dealer) return Result.fail('booking.dealerRequired');
    if (!serviceType) return Result.fail('booking.serviceRequired');
    if (!start) return Result.fail('booking.slotRequired');
    if (!dealer.offers(serviceType)) return Result.fail('booking.serviceUnavailable');
    if (start <= params.now) return Result.fail('booking.slotInPast');

    const type = ServiceTypes.get(serviceType);
    return TimeSlot.create(start, type.durationMinutes).map((slot) =>
      Appointment.restore(params.id, {
        vehicleId: vehicle.id,
        customerId: vehicle.customerId,
        dealerId: dealer.id,
        serviceType,
        slot,
        status: 'scheduled',
        checkInCode: params.checkInCode,
        estimate: AppointmentBuilder.estimate(vehicle, serviceType),
        notes: this.note,
        createdAt: params.now,
      }),
    );
  }

  static estimate(vehicle: Vehicle, serviceType: ServiceTypeKey): Money {
    return vehicle.model.revisionPrice.multiply(ServiceTypes.get(serviceType).priceFactor);
  }
}
