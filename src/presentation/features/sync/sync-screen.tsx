import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Result } from '@/domain/shared/result';
import type { SyncState } from '@/infrastructure/sync/sync-engine';

import { Badge, Button, Card, EmptyState, Icon, ListItem, Screen, SectionHeader, Text, useTheme } from '../../design-system';
import type { IconName, Tone } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { useServices } from '../../providers/services';

const STATUS_VISUAL: Record<SyncState['status'], { icon: IconName; tone: Tone }> = {
  idle: { icon: 'cloudCheck', tone: 'success' },
  syncing: { icon: 'sync', tone: 'primary' },
  offline: { icon: 'cloudOff', tone: 'warning' },
  error: { icon: 'alert', tone: 'danger' },
};

/** Sync center: makes the local-first outbox visible — what is waiting, what was delivered. */
export function SyncScreen() {
  const theme = useTheme();
  const { t, f } = useI18n();
  const { container } = useServices();
  const [state, setState] = useState<SyncState>(container.sync.snapshot);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => container.sync.subscribe(setState), [container]);
  const events = useResult(() => Result.fromPromise(container.useCases.repositories.outbox.recent(25)), [container, state.pending, state.lastSyncedAt], {
    invalidateOn: ['appointment.booked', 'appointment.cancelled', 'vehicle.registered', 'lead.updated', 'sync.completed', 'data.reset'],
  });

  const visual = STATUS_VISUAL[state.status];
  const tone = theme.tone(visual.tone);
  const now = container.clock.now();

  const syncNow = async () => {
    setSyncing(true);
    await container.sync.sync();
    setSyncing(false);
  };

  return (
    <Screen edges="none" testID="sync-screen">
      <Text variant="title1" accessibilityRole="header">
        {t('sync.title')}
      </Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.soft }}>
            <Icon name={visual.icon} size={26} color={tone.onSoft} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title3" testID="sync-status">
              {t(`sync.status.${state.status}`)}
            </Text>
            <Text variant="caption" color="textMuted">
              {t('sync.pending', { count: state.pending })}
            </Text>
            <Text variant="caption" color="textSubtle">
              {state.lastSyncedAt ? t('sync.lastSynced', { when: `${f.relative(state.lastSyncedAt, now)} · ${f.time(state.lastSyncedAt)}` }) : t('sync.never')}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 16, gap: 10 }}>
          <Button label={t('sync.now')} icon="sync" fullWidth loading={syncing || state.status === 'syncing'} onPress={syncNow} testID="sync-now" />
          <Text variant="caption" color="textSubtle" align="center">
            {t('sync.gateway', { name: container.sync.gatewayName })}
          </Text>
        </View>
      </Card>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('sync.events')} />
        {events.data && events.data.length > 0 ? (
          <Card padding={4}>
            {events.data.map((event) => (
              <ListItem
                key={event.id}
                title={t(`sync.types.${event.type}`)}
                subtitle={event.sentAt ? `${f.date(event.sentAt, 'short')} ${f.time(event.sentAt)}` : t('sync.attempts', { count: event.attempts })}
                icon={event.sentAt ? 'cloudCheck' : 'clock'}
                iconTone={event.sentAt ? 'success' : 'warning'}
                trailing={<Badge label={event.sentAt ? t('sync.sent') : t('sync.pendingEvent')} tone={event.sentAt ? 'success' : 'warning'} size="sm" />}
                testID={`event-${event.id}`}
              />
            ))}
          </Card>
        ) : (
          <EmptyState icon="cloudCheck" title={t('sync.status.idle')} />
        )}
      </View>

      <Text variant="caption" color="textSubtle" align="center">
        {t('sync.localFirst')}
      </Text>
    </Screen>
  );
}
