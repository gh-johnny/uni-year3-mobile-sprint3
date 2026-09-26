import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Button, Card, Gauge, Icon, ListItem, Screen, SectionHeader, Text, useTheme } from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { ContributionRowViewModel, LeadPresenter } from '../../presenters/lead-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';

function ContributionBar({ row, color }: { row: ContributionRowViewModel; color: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }} testID={`feature-${row.key}`}>
      <Text variant="callout">{row.text}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ height: 6, borderRadius: 3, width: `${Math.max(6, row.weight * 100)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

/** Lead sheet: why the customer may leave, the next best action, and the pipeline. */
export function LeadScreen() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const feedback = useFeedback();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const [busy, setBusy] = useState(false);
  const useCases = container.useCases;

  const detail = useResult(() => useCases.getLeadDetail.execute(user, vehicleId), [vehicleId, user], { invalidateOn: ['lead.updated', 'appointment.booked', 'data.reset'] });

  if (!detail.data) return <QueryFallback state={detail} edges="none" />;
  const view = LeadPresenter.present(detail.data, i18n);
  const tone = theme.tone(view.tone);

  const run = async (work: () => ReturnType<typeof useCases.contactLead.execute>, success: string) => {
    setBusy(true);
    const result = await work();
    setBusy(false);
    if (result.isFail()) return feedback.error(result.error);
    feedback.success(success);
  };

  return (
    <Screen edges="none" testID="lead-screen">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title1" accessibilityRole="header" numberOfLines={1}>
            {view.name}
          </Text>
          <Text variant="callout" color="textMuted">
            {view.vehicle}
          </Text>
        </View>
        <Badge label={view.statusLabel} tone={view.statusTone} variant="solid" testID="lead-status" />
      </View>

      <Animated.View entering={FadeInDown.duration(320)}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Gauge progress={view.probability} color={tone.solid} size={116} thickness={9} redlineFrom={0.75} testID="risk-gauge">
              <Text variant="metric" tabular style={{ fontSize: 30 }}>
                {view.points}
              </Text>
            </Gauge>
            <View style={{ flex: 1, gap: 8 }}>
              <Text variant="overline" color="textMuted">
                {t('lead.risk')}
              </Text>
              <Badge label={view.tierLabel} tone={view.tone} variant="solid" testID="lead-tier" />
              <Text variant="callout">{view.revenue}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('lead.why')} />
        <Card>
          <View style={{ gap: 14 }}>
            {view.drivers.map((row) => (
              <ContributionBar key={row.key} row={row} color={theme.colors.danger} />
            ))}
          </View>
        </Card>
        {view.protectors.length > 0 ? (
          <>
            <SectionHeader title={t('lead.protects')} />
            <Card>
              <View style={{ gap: 14 }}>
                {view.protectors.map((row) => (
                  <ContributionBar key={row.key} row={row} color={theme.colors.success} />
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('lead.nextBestAction')} />
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft }}>
              <Icon name="sparkle" size={20} color={theme.colors.onAccentSoft} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="title3" testID="next-action-title">
                {view.action.title}
              </Text>
              <Text variant="callout" color="textMuted">
                {view.action.body}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 16, gap: 10 }}>
            <Button
              label={view.action.contactLabel}
              icon="message"
              fullWidth
              disabled={!view.canContact}
              loading={busy}
              onPress={() => run(() => useCases.contactLead.execute(user, vehicleId), t('lead.contacted'))}
              testID="contact-lead"
            />
            {view.noConsent ? (
              <Text variant="caption" color="warning" align="center" testID="no-consent">
                {t('lead.noConsent')}
              </Text>
            ) : null}
          </View>
        </Card>

        {view.moves.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {view.moves.map((move) => (
              <Button
                key={move.status}
                label={move.label}
                size="sm"
                variant={move.status === 'lost' ? 'outline' : move.status === 'won' ? 'primary' : 'secondary'}
                disabled={busy}
                onPress={() => run(() => useCases.updateLeadStatus.execute(user, vehicleId, move.status), t('lead.statusChanged', { status: t(`radar.status.${move.status}`) }))}
                testID={`move-${move.status}`}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 12 }}>
        <SectionHeader title={t('lead.outreaches')} />
        {view.outreaches.length === 0 ? (
          <Text variant="callout" color="textMuted">
            {t('lead.noOutreach')}
          </Text>
        ) : (
          <Card padding={4}>
            {view.outreaches.map((outreach) => (
              <ListItem key={outreach.key} title={outreach.text} subtitle={outreach.when} icon="message" iconTone="accent" />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}
