import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  BarList,
  Button,
  ButtonSize,
  ButtonVariant,
  Card,
  Chip,
  Gauge,
  Icon,
  IconButton,
  ListItem,
  PitStripe,
  QrCode,
  Screen,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Switch,
  Text,
  TextField,
  TrendChart,
  useTheme,
} from '../../design-system';
import type { IconName, Tone } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'accent', 'outline', 'ghost', 'danger'];
const SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg'];
const TONES: readonly Tone[] = ['neutral', 'primary', 'accent', 'success', 'warning', 'danger'];
const TYPE_VARIANTS = ['hero', 'display', 'title1', 'title2', 'title3', 'body', 'callout', 'caption', 'overline', 'metric', 'mono'] as const;
const SWATCHES = ['brand', 'primary', 'accent', 'success', 'warning', 'danger', 'surface', 'surfaceMuted', 'background', 'text'] as const;
const ICONS: readonly IconName[] = ['garage', 'history', 'pin', 'compass', 'gauge', 'radar', 'calendar', 'wrench', 'drop', 'disc', 'tire', 'pulse', 'qr', 'scan', 'shield', 'bolt', 'sparkle', 'sync'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

/** Living style guide: every token and component variant of the Pitlane design system, in the current theme. */
export function DesignSystemScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const [segment, setSegment] = useState<'a' | 'b' | 'c'>('a');
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState(0);

  return (
    <Screen testID="design-system-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="chevronLeft" label={t('common.back')} onPress={() => router.back()} testID="back" />
        <Text variant="title1" accessibilityRole="header" style={{ flex: 1 }}>
          {t('showcase.title')}
        </Text>
      </View>
      <PitStripe height={5} width={72} />

      <Section title={t('showcase.colors')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {SWATCHES.map((name) => (
            <View key={name} style={{ width: 64, gap: 4 }}>
              <View style={{ height: 44, borderRadius: theme.radius.sm, backgroundColor: theme.colors[name], borderWidth: 1, borderColor: theme.colors.border }} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={{ fontSize: 10 }}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t('showcase.typography')}>
        <Card>
          <View style={{ gap: 10 }}>
            {TYPE_VARIANTS.map((variant) => (
              <View key={variant} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text variant="caption" color="textSubtle" style={{ width: 58, fontSize: 10 }}>
                  {variant}
                </Text>
                <Text variant={variant} numberOfLines={1} style={{ flex: 1 }}>
                  {t('showcase.sample')}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      <Section title={t('showcase.buttons')}>
        <View style={{ gap: 10 }}>
          {VARIANTS.map((variant) => (
            <View key={variant} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {SIZES.map((size) => (
                <Button key={size} label={variant} variant={variant} size={size} />
              ))}
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Button label="loading" loading />
            <Button label="disabled" disabled />
            <IconButton icon="plus" label="plus" />
            <IconButton icon="qr" label="qr" variant="primary" />
          </View>
        </View>
      </Section>

      <Section title={t('showcase.badges')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TONES.map((tone) => (
            <Badge key={tone} label={tone} tone={tone} />
          ))}
          {TONES.map((tone) => (
            <Badge key={`solid-${tone}`} label={tone} tone={tone} variant="solid" />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0, 1, 2].map((index) => (
            <Chip key={index} label={`Chip ${index + 1}`} selected={selected === index} count={index * 3} onPress={() => setSelected(index)} />
          ))}
        </View>
      </Section>

      <Section title={t('showcase.inputs')}>
        <TextField label="Label" placeholder="Placeholder" icon="search" />
        <TextField label="Error" value="abc" error="Message" icon="alert" onChangeText={() => undefined} />
        <SegmentedControl value={segment} onChange={setSegment} segments={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />
        <Card>
          <ListItem title="Switch" icon="bolt" trailing={<Switch value={enabled} onValueChange={setEnabled} label="Switch" />} />
        </Card>
      </Section>

      <Section title={t('showcase.data')}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile label="Stat" value="62,9%" icon="pulse" tone="primary" caption="caption" />
          <StatTile label="Risk" value="R$ 17 mil" icon="trendDown" tone="danger" />
        </View>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Gauge progress={0.72} color={theme.colors.primary} size={110} thickness={9} redlineFrom={0.85}>
              <Text variant="metric">72</Text>
            </Gauge>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 }}>
              {ICONS.map((name) => (
                <Icon key={name} name={name} size={22} color={theme.colors.primary} />
              ))}
            </View>
          </View>
        </Card>
        <Card>
          <BarList
            benchmark={0.5}
            data={[
              { key: 'a', label: 'Alpha', ratio: 0.72, valueLabel: '72%' },
              { key: 'b', label: 'Bravo', ratio: 0.48, valueLabel: '48%', highlight: true },
              { key: 'c', label: 'Charlie', ratio: 0.25, valueLabel: '25%', tone: 'danger' },
            ]}
          />
        </Card>
        <Card>
          <TrendChart
            series={[
              { key: 'a', label: 'A', values: [0.4, 0.46, 0.44, 0.52, 0.58, 0.6], color: theme.colors.accent, area: true },
              { key: 'b', label: 'B', values: [0.42, 0.43, 0.45, 0.47, 0.5, 0.52], color: theme.colors.textSubtle, dashed: true },
            ]}
            height={140}
          />
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Avatar initials="AR" tone="accent" />
            <Avatar initials="CS" />
            <View style={{ backgroundColor: '#FFFFFF', padding: 6, borderRadius: 12 }}>
              <QrCode value="PITLANE-DEMO" size={72} />
            </View>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
