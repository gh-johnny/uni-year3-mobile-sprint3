import { AppointmentRepository } from '@/application/ports/repositories';
import { Appointment, AppointmentStatus } from '@/domain/appointment/appointment';
import { Appointments } from '@/domain/appointment/appointments';
import { TimeSlot } from '@/domain/appointment/time-slot';
import { Money } from '@/domain/shared/money';
import { ServiceTypeKey } from '@/domain/service/service-type';

import { SqlDatabase, SqlValue } from '../sql-database';

export type AppointmentRow = {
  id: string;
  vehicle_id: string;
  customer_id: string;
  dealer_id: string;
  service_type: string;
  starts_at: string;
  duration_min: number;
  status: string;
  check_in_code: string;
  estimate_cents: number;
  notes: string | null;
  created_at: string;
};

export const AppointmentMapper = {
  toDomain(row: AppointmentRow): Appointment {
    return Appointment.restore(row.id, {
      vehicleId: row.vehicle_id,
      customerId: row.customer_id,
      dealerId: row.dealer_id,
      serviceType: row.service_type as ServiceTypeKey,
      slot: TimeSlot.restore(new Date(row.starts_at), row.duration_min),
      status: row.status as AppointmentStatus,
      checkInCode: row.check_in_code,
      estimate: Money.fromCents(row.estimate_cents).value,
      notes: row.notes,
      createdAt: new Date(row.created_at),
    });
  },

  toParams(appointment: Appointment): SqlValue[] {
    return [
      appointment.id,
      appointment.vehicleId,
      appointment.customerId,
      appointment.dealerId,
      appointment.serviceType,
      appointment.slot.start.toISOString(),
      appointment.slot.minutes,
      appointment.status,
      appointment.checkInCode,
      appointment.estimate.cents,
      appointment.notes,
      appointment.createdAt.toISOString(),
    ];
  },
} as const;

export const UPSERT_APPOINTMENT = `INSERT OR REPLACE INTO appointments
  (id, vehicle_id, customer_id, dealer_id, service_type, starts_at, duration_min, status, check_in_code, estimate_cents, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export class SqliteAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.db.first<AppointmentRow>('SELECT * FROM appointments WHERE id = ?', [id]);
    return row ? AppointmentMapper.toDomain(row) : null;
  }

  async ofCustomer(customerId: string): Promise<Appointments> {
    const rows = await this.db.all<AppointmentRow>(
      'SELECT * FROM appointments WHERE customer_id = ? ORDER BY starts_at DESC',
      [customerId],
    );
    return Appointments.of(rows.map(AppointmentMapper.toDomain));
  }

  async activeAtDealer(dealerId: string): Promise<Appointments> {
    const rows = await this.db.all<AppointmentRow>(
      "SELECT * FROM appointments WHERE dealer_id = ? AND status IN ('scheduled', 'checked_in')",
      [dealerId],
    );
    return Appointments.of(rows.map(AppointmentMapper.toDomain));
  }

  async save(appointment: Appointment): Promise<void> {
    await this.db.run(UPSERT_APPOINTMENT, AppointmentMapper.toParams(appointment));
  }
}
