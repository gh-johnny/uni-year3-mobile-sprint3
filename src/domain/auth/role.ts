export const PERMISSIONS = [
  'garage:read',
  'appointment:book',
  'appointment:cancel',
  'vehicle:register',
  'pulse:read',
  'leads:read',
  'leads:contact',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type RoleKey = 'owner' | 'advisor';

/** Role-based access control: each role is a fixed, named set of permissions. */
export class Role {
  private static readonly registry = new Map<RoleKey, Role>();

  private constructor(
    readonly key: RoleKey,
    private readonly permissions: ReadonlySet<Permission>,
  ) {}

  static readonly OWNER = Role.register('owner', [
    'garage:read',
    'appointment:book',
    'appointment:cancel',
    'vehicle:register',
  ]);

  static readonly ADVISOR = Role.register('advisor', ['pulse:read', 'leads:read', 'leads:contact']);

  private static register(key: RoleKey, permissions: Permission[]): Role {
    const role = new Role(key, new Set(permissions));
    Role.registry.set(key, role);
    return role;
  }

  static from(key: string): Role | undefined {
    return Role.registry.get(key as RoleKey);
  }

  can(permission: Permission): boolean {
    return this.permissions.has(permission);
  }
}
