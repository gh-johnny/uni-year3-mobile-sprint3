import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Badge, Button, Card, ConfirmDialog, Icon, PitStripe, QrCode, Screen, Text, useTheme } from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { BookingPresenter } from '../../presenters/booking-presenter';
import { APPOINTMENT_TONES } from '../../presenters/shared';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { QueryFallback } from '../shared/query-fallback';

/** Service pass: the QR the reception scans to check the customer in. */
export function PassScreen() {
  const theme = useTheme();
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const pass = useResult(() => container.useCases.getServicePass.execute(user, id), [id, user], {
    invalidateOn: ['appointment.cancelled', 'data.reset'],
  });

  if (!pass.data) return <QueryFallback state={pass} edges="none" />;
  const { appointment, vehicle, dealer } = pass.data;
  const rows = BookingPresenter.summary({ vehicle, dealer, serviceType: appointment.serviceType, start: appointment.slot.start }, i18n);
  const cancellable = appointment.status === 'scheduled';
  const active = appointment.status === 'scheduled' || appointment.status === 'checked_in';

  const cancel = async () => {
    setCancelling(true);
    const result = await container.useCases.cancelAppointment.execute(user, appointment.id);
    setCancelling(false);
    setConfirming(false);
    if (result.isFail()) return feedback.error(result.error);
    feedback.success(t('pass.cancelled'));
    router.back();
  };

  return (
    <Screen edges="none" testID="pass-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title1" accessibilityRole="header">
          {t('pass.title')}
        </Text>
        <Badge label={t(`pass.status.${appointment.status}`)} tone={APPOINTMENT_TONES[appointment.status]} variant="solid" testID="pass-status" />
      </View>

      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center', gap: 14 }}>
        <View
          style={{
            padding: 16,
            borderRadius: theme.radius.xl,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: active ? 1 : 0.35,
          }}
        >
          <QrCode value={appointment.checkInCode} size={208} testID="pass-qr" />
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="overline" color="textMuted">
            {t('pass.code')}
          </Text>
          <Text variant="mono" style={{ fontSize: 20, letterSpacing: 3 }} selectable testID="pass-code">
            {appointment.checkInCode}
          </Text>
          {active ? (
            <Text variant="caption" color="textMuted" align="center">
              {t('pass.checkIn')}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      <PitStripe height={4} width={56} />

      <Animated.View entering={FadeIn.delay(160)}>
        <Card>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: theme.colors.border,
              }}
            >
              <Icon name={row.icon} size={18} color={theme.colors.textMuted} />
              <Text variant="caption" color="textMuted" style={{ width: 64 }}>
                {row.label}
              </Text>
              <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
                {row.value}
              </Text>
            </View>
          ))}
        </Card>
      </Animated.View>

      {cancellable ? <Button label={t('pass.cancel')} variant="danger" icon="close" fullWidth onPress={() => setConfirming(true)} testID="cancel-booking" /> : null}

      <ConfirmDialog
        visible={confirming}
        title={t('pass.cancelTitle')}
        message={t('pass.cancelBody')}
        confirmLabel={cancelling ? t('common.loading') : t('pass.cancel')}
        cancelLabel={t('common.back')}
        destructive
        onConfirm={cancel}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
