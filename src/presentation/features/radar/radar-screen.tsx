import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar, Badge, Card, Chip, EmptyState, PressableScale, Screen, ScreenHeader, SectionHeader, StatTile, Text, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { LeadRowViewModel, RADAR_FILTERS, RadarFilter, RadarPresenter } from '../../presenters/lead-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';
import { SyncPill } from '../sync/sync-pill';
import { RadarSweep } from './radar-sweep';

function LeadRow({ lead, index }: { lead: LeadRowViewModel; index: number }) {
  const theme = useTheme();
  const tone = theme.tone(lead.tone);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
      <PressableScale
        testID={`lead-${lead.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${lead.name}, ${lead.tierLabel}`}
        onPress={() => router.push(`/lead/${lead.id}`)}
        style={{ padding: 16, gap: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar initials={lead.name.split(' ').map((part) => part[0]).join('')} size={44} tone={lead.tone} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title3" numberOfLines={1}>
              {lead.name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {lead.vehicle}
            </Text>
          </View>
          <View style={{ alignItems: 'center', minWidth: 52, paddingVertical: 6, paddingHorizontal: 8, borderRadius: theme.radius.md, backgroundColor: tone.soft }}>
            <Text variant="title2" tabular style={{ color: tone.onSoft }}>
              {lead.points}
            </Text>
            <Text variant="overline" style={{ color: tone.onSoft, fontSize: 9, lineHeight: 11 }}>
              {lead.tierLabel}
            </Text>
          </View>
        </View>
        <Text variant="callout" color="textMuted" numberOfLines={2}>
          {lead.reason}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Badge label={lead.statusLabel} tone={lead.statusTone} size="sm" />
          <Text variant="caption" color="textSubtle">
            {lead.revenue}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

/** Advisor → Radar: every at-risk customer of the dealer, on a sweep and as a filterable list. */
export function RadarScreen() {
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<RadarFilter>('all');
  const radar = useResult(() => container.useCases.getRadar.execute(user), [user, container], {
    invalidateOn: ['lead.updated', 'appointment.booked', 'appointment.cancelled', 'data.reset'],
  });

  if (!radar.data) return <QueryFallback state={radar} withTabBar />;
  const view = RadarPresenter.present(radar.data, filter, i18n);
  const size = Math.min(width - 40, 320);

  return (
    <Screen withTabBar refreshing={radar.refreshing} onRefresh={radar.reload} testID="radar-screen">
      <ScreenHeader eyebrow={view.eyebrow} title={t('radar.title')} accessory={<SyncPill />} />

      <Animated.View entering={FadeInDown.duration(400)}>
        <RadarSweep blips={view.blips} size={size} centerLabel={String(view.blips.length)} centerCaption={t('radar.title')} />
      </Animated.View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label={t('radar.atRisk')} value={view.atRisk} icon="trendDown" tone="danger" />
        <StatTile label={t('radar.title')} value={view.count} icon="radar" tone="primary" caption={view.model} />
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('radar.leads', { count: view.counts[filter] })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
          {RADAR_FILTERS.map((key) => (
            <Chip key={key} label={t(`radar.filters.${key}`)} count={view.counts[key]} selected={filter === key} onPress={() => setFilter(key)} testID={`filter-${key}`} />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
        {view.rows.length === 0 ? (
          <Card variant="filled">
            <EmptyState icon="radar" title={t('radar.empty')} />
          </Card>
        ) : (
          view.rows.map((lead, index) => <LeadRow key={lead.id} lead={lead} index={index} />)
        )}
      </View>
    </Screen>
  );
}
