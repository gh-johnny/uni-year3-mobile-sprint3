import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Appointment } from '@/domain/appointment/appointment';
import { Result } from '@/domain/shared/result';

import { Button, EmptyState, Icon, IconButton, LoadingState, PitStripe, Stepper, Text, useTheme } from '../../design-system';
import { useFeedback } from '../../hooks/use-feedback';
import { useI18n } from '../../hooks/use-i18n';
import { useResult } from '../../hooks/use-result';
import { BookingPresenter } from '../../presenters/booking-presenter';
import { useServices } from '../../providers/services';
import { useCurrentUser } from '../../state/session-store';
import { BOOKING_STEPS, BookingDraft } from './booking-draft';
import { DealerStep, ReviewStep, ServiceStep, SlotStep } from './booking-steps';

function Success({ appointment, model, dealer }: { appointment: Appointment; model: string; dealer: string }) {
  const theme = useTheme();
  const { t, f } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28 }} testID="booking-success">
      <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.success }}>
        <Icon name="check" size={48} color="#FFFFFF" strokeWidth={2.6} />
      </Animated.View>
      <PitStripe height={6} width={64} />
      <Text variant="display" align="center">
        {t('booking.successTitle')}
      </Text>
      <Text variant="body" color="textMuted" align="center">
        {t('booking.successBody', { model, dealer, date: `${f.date(appointment.slot.start, 'long')} · ${f.time(appointment.slot.start)}` })}
      </Text>
      <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 12 }}>
        <Button label={t('booking.viewPass')} icon="qr" size="lg" fullWidth onPress={() => router.replace(`/pass/${appointment.id}`)} testID="view-pass" />
        <Button label={t('common.done')} variant="ghost" fullWidth onPress={() => router.back()} testID="booking-done" />
      </View>
    </View>
  );
}

export function BookingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const i18n = useI18n();
  const { t } = i18n;
  const user = useCurrentUser();
  const { container } = useServices();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ vehicleId: string; serviceType?: string; dealerId?: string }>();
  const [draft, setDraft] = useState(() => BookingDraft.start(params.vehicleId, { serviceType: params.serviceType, dealerId: params.dealerId }));
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const useCases = container.useCases;
  const now = container.clock.now();

  const vehicle = useResult(() => useCases.getVehicleDetail.execute(user, params.vehicleId), [params.vehicleId]);
  const dealers = useResult(() => useCases.listDealersNearby.execute(user, { serviceType: draft.serviceType ?? undefined }), [draft.serviceType]);
  const days = useMemo(() => BookingPresenter.days(useCases.getAvailability.upcomingDays(10), i18n), [useCases, i18n]);
  const day = draft.day ?? days[0]?.date ?? null;
  const slots = useResult(
    async () =>
      draft.dealerId && draft.serviceType && day
        ? useCases.getAvailability.execute({ dealerId: draft.dealerId, serviceType: draft.serviceType, day })
        : Result.ok([]),
    [draft.dealerId, draft.serviceType, day?.getTime()],
    { invalidateOn: ['appointment.booked', 'appointment.cancelled'] },
  );

  if (!vehicle.data) {
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: insets.top + 20, backgroundColor: theme.colors.background }}>
        {vehicle.status === 'error' ? <EmptyState icon="alert" title={i18n.translator.error(vehicle.error?.code ?? '')} /> : <LoadingState />}
      </View>
    );
  }
  const current = vehicle.data.vehicle;
  const dealerList = dealers.data ? BookingPresenter.dealers(dealers.data, i18n, now) : null;
  const selectedDealer = dealers.data?.dealers.find((entry) => entry.dealer.id === draft.dealerId)?.dealer;

  if (booked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingBottom: insets.bottom }}>
        <Success appointment={booked} model={current.model.name} dealer={selectedDealer?.name ?? ''} />
      </View>
    );
  }

  const confirm = async () => {
    const request = draft.toRequest();
    if (!request) return;
    setSubmitting(true);
    const result = await useCases.bookAppointment.execute(user, request);
    setSubmitting(false);
    if (result.isFail()) {
      feedback.error(result.error);
      if (result.error.code === 'booking.slotTaken') setDraft(draft.back());
      return;
    }
    feedback.success(t('booking.successTitle'));
    setBooked(result.value);
  };

  const stepTitle = {
    service: t('booking.chooseService', { model: current.model.name }),
    dealer: t('booking.chooseDealer'),
    slot: t('booking.chooseSlot'),
    review: t('booking.review'),
  }[draft.step];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="booking-screen">
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 14, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="overline" color="primary">
            {t('booking.step', { current: draft.stepIndex + 1, total: BOOKING_STEPS.length })} · {t(`booking.steps.${draft.step}`)}
          </Text>
          <IconButton icon="close" label={t('common.close')} onPress={() => router.back()} testID="booking-close" />
        </View>
        <Stepper total={BOOKING_STEPS.length} current={draft.stepIndex} />
        <Text variant="title1">{stepTitle}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Animated.View key={draft.step} entering={FadeInRight.duration(260)}>
          {draft.step === 'service' ? (
            <ServiceStep options={BookingPresenter.services(current, i18n)} selected={draft.serviceType} onSelect={(key) => setDraft(draft.withService(key).next())} />
          ) : null}
          {draft.step === 'dealer' ? (
            <DealerStep
              options={dealerList}
              source={dealers.data ? t(`booking.locationSource.${dealers.data.source}`) : ''}
              selected={draft.dealerId}
              onSelect={(id) => setDraft(draft.withDealer(id))}
            />
          ) : null}
          {draft.step === 'slot' ? (
            <SlotStep
              days={days}
              selectedDay={day}
              onSelectDay={(date) => setDraft(draft.withDay(date))}
              slots={slots.status === 'loading' ? null : BookingPresenter.slots(slots.data ?? [], i18n)}
              selectedSlot={draft.start}
              onSelectSlot={(start) => setDraft(draft.withDay(day ?? start).withSlot(start))}
            />
          ) : null}
          {draft.step === 'review' && draft.serviceType && draft.start ? (
            <ReviewStep
              rows={BookingPresenter.summary({ vehicle: current, dealer: selectedDealer, serviceType: draft.serviceType, start: draft.start }, i18n)}
              notes={draft.notes}
              onNotes={(notes) => setDraft(draft.withNotes(notes))}
            />
          ) : null}
        </Animated.View>
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: 10,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 14,
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        {!draft.isFirst ? <Button label={t('common.back')} variant="outline" icon="chevronLeft" onPress={() => setDraft(draft.back())} testID="booking-back" /> : null}
        {draft.isLast ? (
          <Button label={t('booking.confirm')} icon="check" haptic="commit" loading={submitting} disabled={!draft.canAdvance()} onPress={confirm} style={{ flex: 1 }} testID="booking-confirm" />
        ) : (
          <Button label={t('common.continue')} trailingIcon="chevronRight" disabled={!draft.canAdvance()} onPress={() => setDraft(draft.next())} style={{ flex: 1 }} testID="booking-next" />
        )}
      </View>
    </View>
  );
}
