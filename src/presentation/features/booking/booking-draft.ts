import { z } from 'zod';

import type { BookingRequest } from '@/application/use-cases/booking';
import { SERVICE_TYPE_KEYS, ServiceTypeKey } from '@/domain/service/service-type';

export const BOOKING_STEPS = ['service', 'dealer', 'slot', 'review'] as const;
export type BookingStep = (typeof BOOKING_STEPS)[number];

export const bookingSchema = z.object({
  vehicleId: z.string().min(1),
  serviceType: z.enum(SERVICE_TYPE_KEYS),
  dealerId: z.string().min(1),
  start: z.date(),
  notes: z.string().max(280).nullable(),
});

type DraftProps = {
  step: number;
  vehicleId: string;
  serviceType: ServiceTypeKey | null;
  dealerId: string | null;
  day: Date | null;
  start: Date | null;
  notes: string;
};

/**
 * Immutable state machine of the booking wizard. Every `with*` returns a new draft,
 * and changing an upstream choice invalidates the dependent ones (a new dealer
 * clears the chosen slot, etc.).
 */
export class BookingDraft {
  private constructor(private readonly props: DraftProps) {}

  /**
   * Opens the wizard, skipping the steps already decided by the entry point
   * (e.g. tapping an offer presets the service; "Book here" on Dealers presets the dealer).
   *
   * @param vehicleId - Vehicle being serviced.
   * @param preset - Optional route params; an unknown `serviceType` is ignored.
   * @example
   * BookingDraft.start('veh-1').step;                                        // 'service'
   * BookingDraft.start('veh-1', { serviceType: 'oil' }).step;                // 'dealer'
   * BookingDraft.start('veh-1', { serviceType: 'oil', dealerId: 'd' }).step; // 'slot'
   */
  static start(vehicleId: string, preset: { serviceType?: string; dealerId?: string } = {}): BookingDraft {
    const serviceType = preset.serviceType && (SERVICE_TYPE_KEYS as readonly string[]).includes(preset.serviceType) ? (preset.serviceType as ServiceTypeKey) : null;
    const dealerId = preset.dealerId ?? null;
    const step = serviceType ? (dealerId ? 2 : 1) : 0;
    return new BookingDraft({ step, vehicleId, serviceType, dealerId, day: null, start: null, notes: '' });
  }

  get step(): BookingStep {
    return BOOKING_STEPS[this.props.step] as BookingStep;
  }
  get stepIndex(): number {
    return this.props.step;
  }
  get vehicleId(): string {
    return this.props.vehicleId;
  }
  get serviceType(): ServiceTypeKey | null {
    return this.props.serviceType;
  }
  get dealerId(): string | null {
    return this.props.dealerId;
  }
  get day(): Date | null {
    return this.props.day;
  }
  get start(): Date | null {
    return this.props.start;
  }
  get notes(): string {
    return this.props.notes;
  }
  get isFirst(): boolean {
    return this.props.step === 0;
  }
  get isLast(): boolean {
    return this.props.step === BOOKING_STEPS.length - 1;
  }

  withService(serviceType: ServiceTypeKey): BookingDraft {
    return this.copy({ serviceType, dealerId: null, day: null, start: null });
  }

  withDealer(dealerId: string): BookingDraft {
    return this.copy({ dealerId, start: null });
  }

  withDay(day: Date): BookingDraft {
    return this.copy({ day, start: null });
  }

  withSlot(start: Date): BookingDraft {
    return this.copy({ start });
  }

  withNotes(notes: string): BookingDraft {
    return this.copy({ notes: notes.slice(0, 280) });
  }

  /** `true` when the current step has what it needs (service chosen, dealer chosen, slot chosen, valid request). */
  canAdvance(): boolean {
    switch (this.step) {
      case 'service':
        return this.props.serviceType !== null;
      case 'dealer':
        return this.props.dealerId !== null;
      case 'slot':
        return this.props.start !== null;
      default:
        return this.toRequest() !== null;
    }
  }

  /** @returns The draft on the next step, or the same instance if the step is incomplete or already the last. */
  next(): BookingDraft {
    return this.canAdvance() && !this.isLast ? this.copy({ step: this.props.step + 1 }) : this;
  }

  /** @returns The draft on the previous step (choices are kept), or the same instance on the first step. */
  back(): BookingDraft {
    return this.isFirst ? this : this.copy({ step: this.props.step - 1 });
  }

  /**
   * Validates the draft with `bookingSchema` (Zod).
   *
   * @returns The `BookingRequest` for `BookAppointment`, or `null` while anything is missing.
   *          Blank notes become `null`; notes are capped at 280 characters.
   */
  toRequest(): BookingRequest | null {
    const parsed = bookingSchema.safeParse({
      vehicleId: this.props.vehicleId,
      serviceType: this.props.serviceType,
      dealerId: this.props.dealerId,
      start: this.props.start,
      notes: this.props.notes.trim() || null,
    });
    return parsed.success ? parsed.data : null;
  }

  private copy(patch: Partial<DraftProps>): BookingDraft {
    return new BookingDraft({ ...this.props, ...patch });
  }
}
