import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, EmptyState, Icon, PressableScale, Screen, ScreenHeader, SectionHeader, Text, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { TimelineItemViewModel, TimelinePresenter } from '../../presenters/timeline-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';

function TimelineRow({ item, last, index }: { item: TimelineItemViewModel; last: boolean; index: number }) {
  const theme = useTheme();
  const tone = theme.tone(item.tone);
  const body = (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.soft }}>
          <Icon name={item.icon} size={19} color={tone.onSoft} />
        </View>
        {last ? null : <View style={{ flex: 1, width: 2, marginTop: 4, borderRadius: 1, backgroundColor: theme.colors.border }} />}
      </View>
      <View style={{ flex: 1, gap: 4, paddingBottom: last ? 0 : 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="title3" numberOfLines={1} style={{ flex: 1 }}>
            {item.title}
          </Text>
          <Badge label={item.badge.label} tone={item.badge.tone} size="sm" />
        </View>
        <Text variant="callout" color="textMuted" numberOfLines={1}>
          {item.vehicle} · {item.place}
        </Text>
        <Text variant="caption" color="textSubtle">
          {item.when}
        </Text>
        <Text variant="caption" color="textMuted">
          {item.meta}
        </Text>
      </View>
    </View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}>
      {item.appointmentId ? (
        <PressableScale testID={`timeline-${item.key}`} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(`/pass/${item.appointmentId}`)}>
          {body}
        </PressableScale>
      ) : (
        <View testID={`timeline-${item.key}`}>{body}</View>
      )}
    </Animated.View>
  );
}

export function HistoryScreen() {
  const user = useCurrentUser();
  const { container } = useServices();
  const i18n = useI18n();
  const { t } = i18n;
  const timeline = useResult(() => container.useCases.getTimeline.execute(user), [user, container], {
    invalidateOn: ['appointment.booked', 'appointment.cancelled', 'data.reset'],
  });

  if (!timeline.data) return <QueryFallback state={timeline} withTabBar />;
  const groups = TimelinePresenter.present(timeline.data, i18n, container.clock.now());

  return (
    <Screen withTabBar refreshing={timeline.refreshing} onRefresh={timeline.reload} testID="history-screen">
      <ScreenHeader eyebrow={t('timeline.eyebrow')} title={t('timeline.title')} />
      {groups.length === 0 ? (
        <EmptyState icon="history" title={t('timeline.empty')} message={t('timeline.emptyHint')} />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={{ gap: 16 }}>
            <SectionHeader title={group.title} />
            <View>
              {group.items.map((item, index) => (
                <TimelineRow key={item.key} item={item} index={index} last={index === group.items.length - 1} />
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
