import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge, Card, EmptyState, Icon, PressableScale, Skeleton, Text, TextField, useTheme } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import type { DayOptionViewModel, DealerOptionViewModel, ServiceOptionViewModel, SlotOptionViewModel } from '../../presenters/booking-presenter';

function Selectable({ selected, onPress, testID, label, children }: { selected: boolean; onPress: () => void; testID: string; label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      haptic="select"
      onPress={onPress}
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 1.5,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
      }}
    >
      {children}
    </PressableScale>
  );
}

export function ServiceStep({ options, selected, onSelect }: { options: ServiceOptionViewModel[]; selected: string | null; onSelect: (key: ServiceOptionViewModel['key']) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <View key={option.key} style={{ width: '48%', flexGrow: 1 }}>
            <Selectable selected={active} onPress={() => onSelect(option.key)} testID={`service-${option.key}`} label={option.label}>
              <View style={{ padding: 14, gap: 12, minHeight: 132 }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted }}>
                  <Icon name={option.icon} size={21} color={active ? theme.colors.onPrimary : theme.colors.text} />
                </View>
                <Text variant="title3" numberOfLines={2}>
                  {option.label}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" color="textMuted">
                    {option.duration}
                  </Text>
                  <Text variant="caption" color={active ? 'onPrimarySoft' : 'text'} tabular>
                    {option.price}
                  </Text>
                </View>
              </View>
            </Selectable>
          </View>
        );
      })}
    </View>
  );
}

export function DealerStep({ options, source, selected, onSelect }: { options: DealerOptionViewModel[] | null; source: string; selected: string | null; onSelect: (id: string) => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!options) {
    return (
      <View style={{ gap: 12 }}>
        <Skeleton height={76} radius={20} />
        <Skeleton height={76} radius={20} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="navigation" size={14} color={theme.colors.primary} />
        <Text variant="caption" color="textMuted">
          {source}
        </Text>
      </View>
      {options.map((dealer) => (
        <Selectable key={dealer.id} selected={dealer.id === selected} onPress={() => onSelect(dealer.id)} testID={`dealer-${dealer.id}`} label={dealer.name}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {dealer.name}
                </Text>
                {dealer.closest ? <Badge label={t('booking.closestBadge')} tone="accent" size="sm" /> : null}
              </View>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {dealer.place}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text variant="callout" tabular>
                {dealer.distance}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="star" size={12} color={theme.colors.warning} strokeWidth={2} />
                <Text variant="caption" color="textMuted" tabular>
                  {dealer.rating}
                </Text>
              </View>
            </View>
          </View>
        </Selectable>
      ))}
    </View>
  );
}

export function SlotStep({
  days,
  selectedDay,
  onSelectDay,
  slots,
  selectedSlot,
  onSelectSlot,
}: {
  days: DayOptionViewModel[];
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  slots: SlotOptionViewModel[] | null;
  selectedSlot: Date | null;
  onSelectSlot: (start: Date) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 18 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((day) => {
          const active = selectedDay?.getTime() === day.date.getTime();
          return (
            <PressableScale
              key={day.key}
              testID={`day-${day.day}`}
              accessibilityRole="radio"
              accessibilityLabel={`${day.weekday} ${day.day}`}
              accessibilityState={{ selected: active }}
              haptic="select"
              onPress={() => onSelectDay(day.date)}
              style={{
                width: 58,
                paddingVertical: 10,
                alignItems: 'center',
                gap: 2,
                borderRadius: theme.radius.md,
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
              }}
            >
              <Text variant="overline" style={{ fontSize: 10, color: active ? theme.colors.onPrimary : theme.colors.textMuted }}>
                {day.weekday}
              </Text>
              <Text variant="title2" style={{ color: active ? theme.colors.onPrimary : theme.colors.text }}>
                {day.day}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
      {slots === null ? (
        <Skeleton height={120} radius={20} />
      ) : slots.length === 0 ? (
        <EmptyState icon="calendar" title={t('booking.noSlots')} />
      ) : (
        <Animated.View entering={FadeIn.duration(220)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {slots.map((slot) => {
            const active = selectedSlot?.getTime() === slot.start.getTime();
            return (
              <PressableScale
                key={slot.key}
                testID={`slot-${slot.time}`}
                accessibilityRole="radio"
                accessibilityLabel={slot.time}
                accessibilityState={{ selected: active }}
                haptic="select"
                onPress={() => onSelectSlot(slot.start)}
                style={{
                  width: '31%',
                  flexGrow: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderRadius: theme.radius.md,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text variant="title3" tabular style={{ color: active ? theme.colors.onPrimary : theme.colors.text }}>
                  {slot.time}
                </Text>
                {slot.scarcity ? (
                  <Text variant="caption" style={{ fontSize: 11, color: active ? theme.colors.onPrimary : theme.colors.accent }}>
                    {slot.scarcity}
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

export function ReviewStep({ rows, notes, onNotes }: { rows: { key: string; icon: Parameters<typeof Icon>[0]['name']; label: string; value: string }[]; notes: string; onNotes: (value: string) => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: 18 }}>
      <Card padding={4}>
        {rows.map((row, index) => (
          <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: index === 0 ? 0 : 1, borderColor: theme.colors.border }}>
            <Icon name={row.icon} size={18} color={theme.colors.primary} />
            <Text variant="caption" color="textMuted" style={{ width: 84 }}>
              {row.label}
            </Text>
            <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={2} testID={`review-${row.key}`}>
              {row.value}
            </Text>
          </View>
        ))}
      </Card>
      <TextField label={t('booking.notes')} placeholder={t('booking.notesPlaceholder')} value={notes} onChangeText={onNotes} multiline maxLength={280} icon="message" testID="booking-notes" />
    </View>
  );
}
