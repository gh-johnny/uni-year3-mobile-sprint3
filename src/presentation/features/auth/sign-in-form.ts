import { z } from 'zod';

import type { RoleKey } from '@/domain/auth/role';

import type { I18n } from '../../hooks/use-i18n';

export const DEMO_PASSWORD = 'ford2026';

export const DEMO_ACCOUNTS: Readonly<Record<RoleKey, { email: string; password: string }>> = {
  owner: { email: 'ana@pitlane.app', password: DEMO_PASSWORD },
  advisor: { email: 'carlos@pitlane.app', password: DEMO_PASSWORD },
};

/** Zod schema with localised messages — the same rules the form and tests use. */
export const signInSchema = (t: I18n['t']) =>
  z.object({
    email: z.email({ error: t('auth.validation.email') }),
    password: z.string().min(6, { error: t('auth.validation.password') }),
  });

export type SignInValues = z.infer<ReturnType<typeof signInSchema>>;
