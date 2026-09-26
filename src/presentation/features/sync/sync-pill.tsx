import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import type { SyncState } from '@/infrastructure/sync/sync-engine';

import { Icon, PressableScale, Text, useTheme } from '../../design-system';
import type { IconName, Tone } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useServices } from '../../providers/services';

const VISUAL: Record<SyncState['status'], { icon: IconName; tone: Tone }> = {
  idle: { icon: 'cloudCheck', tone: 'success' },
  syncing: { icon: 'sync', tone: 'primary' },
  offline: { icon: 'cloudOff', tone: 'warning' },
  error: { icon: 'alert', tone: 'danger' },
};

/** Global sync/offline indicator: status icon (+ pending count); one tap opens the sync center. */
export function SyncPill() {
  const theme = useTheme();
  const { t } = useI18n();
  const { container } = useServices();
  const [state, setState] = useState<SyncState>(container.sync.snapshot);
  useEffect(() => container.sync.subscribe(setState), [container]);

  const visual = VISUAL[state.status];
  const tone = theme.tone(visual.tone);
  return (
    <PressableScale
      testID="sync-pill"
      accessibilityRole="button"
      accessibilityLabel={`${t(`sync.status.${state.status}`)} · ${t('sync.pending', { count: state.pending })}`}
      onPress={() => router.push('/sync')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, minWidth: 36, paddingHorizontal: 10, justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: tone.soft }}
    >
      <Icon name={visual.icon} size={17} color={tone.onSoft} />
      {state.pending > 0 ? (
        <Text variant="callout" tabular style={{ color: tone.onSoft }}>
          {state.pending}
        </Text>
      ) : null}
    </PressableScale>
  );
}
