import { LeadStateRepository, OutreachRepository } from '@/application/ports/repositories';
import { LeadState, LeadStatus } from '@/domain/retention/lead';
import { NextBestActionKey, OutreachChannel } from '@/domain/retention/next-best-action';
import { Outreach } from '@/domain/retention/outreach';

import { SqlDatabase } from '../sql-database';

type LeadStateRow = {
  vehicle_id: string;
  status: string;
  contact_count: number;
  last_contact_at: string | null;
  updated_at: string;
};

type OutreachRow = {
  id: string;
  vehicle_id: string;
  advisor_id: string;
  channel: string;
  action: string;
  discount: number;
  created_at: string;
};

export class SqliteLeadStateRepository implements LeadStateRepository {
  constructor(private readonly db: SqlDatabase) {}

  async all(): Promise<Map<string, LeadState>> {
    const rows = await this.db.all<LeadStateRow>('SELECT * FROM lead_states');
    return new Map(
      rows.map((row) => [
        row.vehicle_id,
        {
          vehicleId: row.vehicle_id,
          status: row.status as LeadStatus,
          contactCount: row.contact_count,
          lastContactAt: row.last_contact_at ? new Date(row.last_contact_at) : null,
          updatedAt: new Date(row.updated_at),
        },
      ]),
    );
  }

  async save(state: LeadState): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO lead_states (vehicle_id, status, contact_count, last_contact_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        state.vehicleId,
        state.status,
        state.contactCount,
        state.lastContactAt?.toISOString() ?? null,
        state.updatedAt.toISOString(),
      ],
    );
  }
}

export class SqliteOutreachRepository implements OutreachRepository {
  constructor(private readonly db: SqlDatabase) {}

  async forVehicle(vehicleId: string): Promise<Outreach[]> {
    const rows = await this.db.all<OutreachRow>(
      'SELECT * FROM outreaches WHERE vehicle_id = ? ORDER BY created_at DESC',
      [vehicleId],
    );
    return rows.map((row) =>
      Outreach.restore(row.id, {
        vehicleId: row.vehicle_id,
        advisorId: row.advisor_id,
        channel: row.channel as OutreachChannel,
        action: row.action as NextBestActionKey,
        discount: row.discount,
        createdAt: new Date(row.created_at),
      }),
    );
  }

  async save(outreach: Outreach): Promise<void> {
    await this.db.run(
      `INSERT INTO outreaches (id, vehicle_id, advisor_id, channel, action, discount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        outreach.id,
        outreach.vehicleId,
        outreach.advisorId,
        outreach.channel,
        outreach.action,
        outreach.discount,
        outreach.createdAt.toISOString(),
      ],
    );
  }
}
