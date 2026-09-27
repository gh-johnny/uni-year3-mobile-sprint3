import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { ShareDimension } from '@/domain/analytics/service-share-calculator';

import { AnimatedNumber, Badge, BarList, Card, Circuit, CornerCut, Icon, Screen, ScreenHeader, SectionHeader, SegmentedControl, Text, TrendChart, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { PULSE_DIMENSIONS, PulsePresenter } from '../../presenters/pulse-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';
import { SyncPill } from '../sync/sync-pill';

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 0, borderTopWidth: 3, borderStyle: dashed ? 'dashed' : 'solid', borderColor: color }} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

/** Advisor → Pulse: Service Share (VIN Share) of the dealer vs the network, sliced four ways. */
export function PulseScreen() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t, f } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const [dimension, setDimension] = useState<ShareDimension>('dealer');
  const pulse = useResult(() => container.useCases.getPulse.execute(user), [user, container], { invalidateOn: ['data.reset'] });

  if (!pulse.data) return <QueryFallback state={pulse} withTabBar />;
  const view = PulsePresenter.present(pulse.data, i18n);
  const ownColor = theme.colors.primary;
  const networkColor = theme.colors.textSubtle;

  return (
    <Screen withTabBar refreshing={pulse.refreshing} onRefresh={pulse.reload} testID="pulse-screen">
      <ScreenHeader eyebrow={view.eyebrow} title={t('pulse.title')} accessory={<SyncPill />} />

      <Animated.View entering={FadeInDown.duration(380)} style={{ padding: 22, gap: 18, borderRadius: 4, borderBottomLeftRadius: 36, backgroundColor: theme.colors.signal, overflow: 'hidden' }} testID="pulse-hero">
        <Circuit size={170} color={theme.colors.onSignal} style={{ position: 'absolute', right: -16, top: 24, opacity: 0.25 }} />
        <Text variant="overline" style={{ color: theme.colors.onSignal }} numberOfLines={1}>
          {view.dealerName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" style={{ color: theme.colors.onSignal }}>{t('pulse.you')}</Text>
            <AnimatedNumber value={view.own.progress * 100} format={(value) => `${f.number(value, 1)}%`} variant="metric" style={{ color: theme.colors.onSignal, fontSize: 58, lineHeight: 64, letterSpacing: -2.8 }} numberOfLines={1} adjustsFontSizeToFit testID="share-value" />
          </View>
        </View>
        <Badge label={view.own.delta} tone={view.own.deltaTone} icon={view.own.deltaTone === 'success' ? 'trendUp' : 'trendDown'} testID="share-delta" />
        <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: `${theme.colors.onSignal}33` }}>
          {[
            { label: t('pulse.network'), value: view.network.value },
            { label: t('pulse.retained'), value: view.own.retained },
            { label: t('pulse.park'), value: view.own.park },
          ].map((stat) => (
            <View key={stat.label} style={{ flex: 1, gap: 4 }}>
              <Text variant="caption" style={{ color: theme.colors.onSignal }}>{stat.label}</Text>
              <Text variant="title3" style={{ color: theme.colors.onSignal }} tabular numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
            </View>
          ))}
        </View>
        <Text variant="caption" style={{ color: theme.colors.onSignal }}>
          {t('pulse.definition')}
        </Text>
        <CornerCut color={theme.colors.background} size={28} />
      </Animated.View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('pulse.trend')} />
        <Card>
          <TrendChart
            testID="trend-chart"
            labels={view.trend.labels}
            formatValue={(value) => f.percent(value, 0)}
            series={[
              { key: 'own', label: t('pulse.you'), values: view.trend.own, color: ownColor, area: true },
              { key: 'network', label: t('pulse.network'), values: view.trend.network, color: networkColor, dashed: true },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 12 }}>
            <LegendDot color={ownColor} label={t('pulse.you')} />
            <LegendDot color={networkColor} label={t('pulse.network')} dashed />
          </View>
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('pulse.breakdown')} />
        <SegmentedControl<ShareDimension>
          testID="dimension-control"
          value={dimension}
          onChange={setDimension}
          segments={PULSE_DIMENSIONS.map((key) => ({ value: key, label: t(`pulse.dimensions.${key}`) }))}
        />
        <Card>
          <BarList testID="breakdown-bars" data={view.breakdowns[dimension]} benchmark={dimension === 'serviceType' ? undefined : view.networkAverage} />
          <Text variant="caption" color="textSubtle" style={{ marginTop: 14 }}>
            {dimension === 'serviceType' ? t('pulse.serviceTypeHint') : `${t('pulse.networkAverage')}: ${view.network.value}`}
          </Text>
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('pulse.anomaliesTitle')} />
        {view.anomalies.length === 0 && !view.trendBreak ? (
          <Card variant="filled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="check" size={20} color={theme.colors.success} />
              <Text variant="callout" style={{ flex: 1 }}>
                {t('pulse.noAnomalies')}
              </Text>
            </View>
          </Card>
        ) : null}
        {view.anomalies.map((anomaly) => {
          const tone = theme.tone(anomaly.tone);
          return (
            <Card key={anomaly.key} testID={`anomaly-${anomaly.key}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: tone.soft }}>
                  <Icon name={anomaly.tone === 'danger' ? 'alert' : 'trendUp'} size={18} color={tone.onSoft} />
                </View>
                <Text variant="callout" style={{ flex: 1 }}>
                  {anomaly.message}
                </Text>
              </View>
            </Card>
          );
        })}
        {view.trendBreak ? (
          <Card testID="trend-break">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="pulse" size={20} color={theme.colors.warning} />
              <Text variant="callout" style={{ flex: 1 }}>
                {view.trendBreak}
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
