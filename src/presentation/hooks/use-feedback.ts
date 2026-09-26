import { useMemo } from 'react';

import type { DomainError } from '@/domain/shared/domain-error';

import { useHaptics } from '../providers/services';
import { useToasts } from '../state/toast-store';
import { useI18n } from './use-i18n';

/** One place to say "it worked" / "it failed": toast + matching haptic. */
export function useFeedback() {
  const show = useToasts((state) => state.show);
  const haptics = useHaptics();
  const { translator } = useI18n();

  return useMemo(
    () => ({
      success(title: string, message?: string) {
        haptics.success();
        show({ tone: 'success', title, message });
      },
      info(title: string, message?: string) {
        haptics.select();
        show({ tone: 'primary', title, message });
      },
      error(error: DomainError) {
        haptics.error();
        show({ tone: 'danger', title: translator.error(error.code, error.details) });
      },
    }),
    [show, haptics, translator],
  );
}
