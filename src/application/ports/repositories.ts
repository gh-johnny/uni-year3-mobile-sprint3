import { Appointment } from '@/domain/appointment/appointment';
import { Appointments } from '@/domain/appointment/appointments';
import { User } from '@/domain/auth/user';
import { Customer } from '@/domain/customer/customer';
import { Dealer } from '@/domain/dealer/dealer';
import { Dealers } from '@/domain/dealer/dealers';
import { LeadState } from '@/domain/retention/lead';
import { Outreach } from '@/domain/retention/outreach';
import { ServiceHistory } from '@/domain/service/service-history';
import { Vehicle } from '@/domain/vehicle/vehicle';
import { Vehicles } from '@/domain/vehicle/vehicles';

/**
 * Repository ports. The application layer depends on these interfaces only;
 * SQLite (production) and in-memory (tests) adapters implement them.
 */
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  all(): Promise<Customer[]>;
}

export interface DealerRepository {
  all(): Promise<Dealers>;
  findById(id: string): Promise<Dealer | null>;
}

export interface VehicleRepository {
  all(): Promise<Vehicles>;
  findById(id: string): Promise<Vehicle | null>;
  findByVin(vin: string): Promise<Vehicle | null>;
  ownedBy(customerId: string): Promise<Vehicles>;
  save(vehicle: Vehicle): Promise<void>;
}

export interface ServiceRecordRepository {
  all(): Promise<ServiceHistory>;
  forVehicles(vehicleIds: readonly string[]): Promise<ServiceHistory>;
}

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  ofCustomer(customerId: string): Promise<Appointments>;
  activeAtDealer(dealerId: string): Promise<Appointments>;
  save(appointment: Appointment): Promise<void>;
}

export interface LeadStateRepository {
  all(): Promise<Map<string, LeadState>>;
  save(state: LeadState): Promise<void>;
}

export interface OutreachRepository {
  forVehicle(vehicleId: string): Promise<Outreach[]>;
  save(outreach: Outreach): Promise<void>;
}
