import { act, fireEvent, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text as RNText, View } from 'react-native';

import { createTestServices, renderWithServices, TestServices } from '@/test-utils/render';

import { Avatar, Badge, BarList, Button, ButtonSize, ButtonVariant, Card, Chip, ConfirmDialog, Divider, EmptyState, FormTextField, Gauge, Icon, IconButton, ListItem, LoadingState, PitStripe, QrCode, Screen, ScreenHeader, SectionHeader, SegmentedControl, StatTile, Stepper, Switch, Text, TextField, ToastHost, TrendChart, Wordmark, AnimatedNumber, Theme, useTheme } from '.';
import { smoothPath } from './components/charts';
import { ICON_NAMES } from './icons/glyphs';
import { qrMatrix, qrPath } from './components/qr-code';
import { usePreferences } from '../state/preferences-store';
import { TOAST_DURATION_MS } from './components/feedback';
import { useToasts } from '../state/toast-store';

jest.setTimeout(15000);

let services: TestServices;

beforeEach(async () => {
  services = await createTestServices();
});

const show = (ui: React.ReactElement) => renderWithServices(ui, services);

describe('Theme', () => {
  it('builds immutable light and dark themes with tone palettes', () => {
    const light = Theme.for('light');
    const dark = Theme.for('dark');
    expect(Theme.for('light')).toBe(light);
    expect(light.isDark).toBe(false);
    expect(dark.isDark).toBe(true);
    expect(light.colors.background).not.toBe(dark.colors.background);
    for (const tone of ['neutral', 'primary', 'accent', 'success', 'warning', 'danger'] as const) {
      expect(Object.keys(light.tone(tone))).toEqual(expect.arrayContaining(['solid', 'soft', 'onSoft']));
    }
  });

  it('follows the preference, falling back to the system scheme', async () => {
    const Probe = () => <RNText testID="scheme">{useTheme().isDark ? 'dark' : 'light'}</RNText>;
    await show(<Probe />);
    expect(screen.getByTestId('scheme')).toHaveTextContent('light');
    await act(async () => usePreferences.getState().setTheme('dark'));
    expect(screen.getByTestId('scheme')).toHaveTextContent('dark');
    await act(async () => usePreferences.getState().setTheme('system'));
    expect(screen.getByTestId('scheme')).toHaveTextContent(/light|dark/);
  });
});

describe('Text, Icon, Avatar, Divider', () => {
  it('renders typography variants and every icon glyph', async () => {
    await show(
      <View>
        <Text variant="hero" color="primary" align="center" tabular>
          hero
        </Text>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={20} color="#000" testID={`icon-${name}`} />
        ))}
        <Avatar initials="jm" />
        <Divider />
      </View>,
    );
    expect(screen.getByText('hero')).toBeOnTheScreen();
    expect(screen.getByLabelText('jm')).toHaveTextContent('JM');
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(45);
  });
});

describe('Button', () => {
  it.each<[ButtonVariant, ButtonSize]>([
    ['primary', 'sm'],
    ['secondary', 'md'],
    ['accent', 'lg'],
    ['outline', 'md'],
    ['ghost', 'md'],
    ['danger', 'md'],
    ['inverse', 'md'],
  ])('renders the %s variant at size %s and fires haptic + onPress', async (variant, size) => {
    const onPress = jest.fn();
    const tap = jest.spyOn(services.haptics, 'tap');
    await show(<Button label="Go" variant={variant} size={size} icon="plus" trailingIcon="chevronRight" onPress={onPress} fullWidth />);
    await userEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and ignores presses while loading or disabled', async () => {
    const onPress = jest.fn();
    await show(
      <View>
        <Button label="Load" loading onPress={onPress} testID="loading" />
        <Button label="Off" disabled onPress={onPress} testID="off" />
      </View>,
    );
    expect(screen.getByTestId('button-spinner')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('loading'));
    await userEvent.press(screen.getByTestId('off'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('can opt out of haptics', async () => {
    const tap = jest.spyOn(services.haptics, 'tap');
    await show(<Button label="Quiet" haptic="none" onPress={jest.fn()} />);
    await userEvent.press(screen.getByRole('button', { name: 'Quiet' }));
    expect(tap).not.toHaveBeenCalled();
  });

  it('IconButton exposes its label and every variant', async () => {
    const onPress = jest.fn();
    await show(
      <View>
        {(['surface', 'ghost', 'primary', 'inverse'] as const).map((variant) => (
          <IconButton key={variant} icon="plus" label={variant} variant={variant} onPress={onPress} />
        ))}
      </View>,
    );
    await userEvent.press(screen.getByLabelText('primary'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});

describe('Card, Badge, Chip, ListItem', () => {
  it('cards are pressable only when given a handler', async () => {
    const onPress = jest.fn();
    await show(
      <View>
        <Card testID="static" variant="filled">
          <Text>static</Text>
        </Card>
        <Card testID="tappable" onPress={onPress} accessibilityLabel="open">
          <Text>tappable</Text>
        </Card>
      </View>,
    );
    await userEvent.press(screen.getByLabelText('open'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('static')).toBeOnTheScreen();
  });

  it('badges cover tones, variants and sizes', async () => {
    await show(
      <View>
        {(['soft', 'solid', 'outline'] as const).map((variant) => (
          <Badge key={variant} label={variant} variant={variant} tone="accent" icon="check" size="sm" />
        ))}
      </View>,
    );
    expect(screen.getByText('solid')).toBeOnTheScreen();
  });

  it('chips report selection, count and taps', async () => {
    const onPress = jest.fn();
    await show(<Chip label="All" count={12} selected icon="filter" onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    expect(screen.getByText('12')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('list items show title, subtitle, value, chevron and destructive state', async () => {
    const onPress = jest.fn();
    await show(
      <View>
        <ListItem title="Row" subtitle="sub" value="42" icon="wrench" chevron onPress={onPress} testID="row" />
        <ListItem title="Danger" destructive leading={<Text>lead</Text>} trailing={<Text>trail</Text>} />
      </View>,
    );
    expect(screen.getByText('sub')).toBeOnTheScreen();
    expect(screen.getByText('42')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('trail')).toBeOnTheScreen();
  });
});

describe('Inputs', () => {
  it('switch toggles and respects disabled', async () => {
    const Harness = ({ disabled }: { disabled?: boolean }) => {
      const [on, setOn] = useState(false);
      return <Switch label="Haptics" value={on} onValueChange={setOn} disabled={disabled} testID="switch" />;
    };
    await show(<Harness />);
    const control = screen.getByTestId('switch');
    await userEvent.press(control);
    expect(screen.getByLabelText('Haptics')).toBeChecked();
    await userEvent.press(control);
    expect(screen.getByLabelText('Haptics')).not.toBeChecked();

    await show(<Harness disabled />);
    await userEvent.press(screen.getAllByTestId('switch').at(-1)!);
    expect(screen.getAllByLabelText('Haptics').at(-1)).not.toBeChecked();
  });

  it('segmented control moves selection and lays out its thumb', async () => {
    const onChange = jest.fn();
    await show(
      <SegmentedControl testID="seg" value="b" onChange={onChange} segments={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />,
    );
    await fireEvent(screen.getByTestId('seg'), 'layout', { nativeEvent: { layout: { width: 200, height: 40, x: 0, y: 0 } } });
    await userEvent.press(screen.getByText('A'));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('text field shows label, hint, error and focus state', async () => {
    await show(
      <View>
        <TextField label="Email" hint="We never share it" icon="mail" mono />
        <TextField label="Bad" error="Required" testID="bad" />
      </View>,
    );
    expect(screen.getByText('We never share it')).toBeOnTheScreen();
    expect(screen.getByText('Required')).toBeOnTheScreen();
    const input = screen.getByLabelText('Email');
    await fireEvent(input, 'focus');
    await fireEvent(input, 'blur');
  });

  it('form text field binds react-hook-form and applies its transform', async () => {
    let latest = '';
    const Form = () => {
      const { control, watch } = useForm({ defaultValues: { code: '' } });
      latest = watch('code');
      return <FormTextField control={control} name="code" label="Code" transform={(text) => text.toUpperCase()} />;
    };
    await show(<Form />);
    await userEvent.type(screen.getByLabelText('Code'), 'abc');
    expect(latest).toBe('ABC');
  });
});

describe('Layout', () => {
  it('screen renders scrolling and static content, with pull-to-refresh', async () => {
    const onRefresh = jest.fn();
    await show(
      <Screen testID="scroll" onRefresh={onRefresh} refreshing={false} withTabBar>
        <ScreenHeader eyebrow="Eyebrow" title="Title" accessory={<Text>acc</Text>} />
        <SectionHeader title="Section" action={<Text>act</Text>} />
      </Screen>,
    );
    expect(screen.getByRole('header', { name: 'Title' })).toBeOnTheScreen();
    expect(screen.getByText('Eyebrow')).toBeOnTheScreen();
    const control = screen.getByTestId('scroll').props.refreshControl;
    await act(async () => control.props.onRefresh());
    expect(onRefresh).toHaveBeenCalled();

    await show(
      <Screen scroll={false} edges="none" testID="fixed">
        <Text>fixed</Text>
      </Screen>,
    );
    expect(screen.getByTestId('fixed')).toBeOnTheScreen();
  });

  it('empty and loading states', async () => {
    const onAction = jest.fn();
    await show(
      <View>
        <EmptyState icon="alert" tone="danger" title="Nothing" message="Try later" actionLabel="Retry" onAction={onAction} />
        <LoadingState />
        <StatTile label="Stat" value="9" caption="cap" icon="pulse" tone="success" />
      </View>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.getByText('cap')).toBeOnTheScreen();
  });
});

describe('Confirm dialog', () => {
  it('confirm dialog reports confirm and cancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await show(<ConfirmDialog visible title="Sure?" message="Really" confirmLabel="Yes" cancelLabel="No" destructive onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Really')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Yes' }));
    await userEvent.press(screen.getByRole('button', { name: 'No' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Brand', () => {
  it('draws the wordmark, pit stripe and stepper', async () => {
    await show(
      <View>
        <Wordmark inverse />
        <PitStripe color="#fff" opacity={0.5} width={40} />
        <Stepper total={4} current={1} />
      </View>,
    );
    expect(screen.getByLabelText('Pitlane')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', { min: 1, max: 4, now: 2 });
  });

  it('animated number counts up to its value', async () => {
    jest.useFakeTimers();
    try {
      await show(<AnimatedNumber value={50} format={(value) => `${Math.round(value)}%`} duration={200} />);
      await act(async () => jest.advanceTimersByTime(400));
      expect(screen.getByText('50%')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Feedback', () => {
  it('toast host shows queued toasts and auto-dismisses them', async () => {
    jest.useFakeTimers();
    try {
      await show(<ToastHost />);
      await act(async () => {
        useToasts.getState().show({ tone: 'success', title: 'Saved', message: 'detail' });
        useToasts.getState().show({ tone: 'danger', title: 'Oops' });
      });
      expect(screen.getByText('Saved')).toBeOnTheScreen();
      expect(screen.getByText('detail')).toBeOnTheScreen();
      await userEvent.press(screen.getByLabelText('Oops'));
      expect(screen.queryByText('Oops')).not.toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS + 50));
      expect(screen.queryByText('Saved')).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Data visualisation', () => {
  it('gauge renders ticks and reports when the needle settles', async () => {
    jest.useFakeTimers();
    try {
      const onSettled = jest.fn();
      await show(
        <Gauge progress={0.8} color="#0f0" redlineFrom={0.7} needle onSettled={onSettled} testID="gauge">
          <Text>80</Text>
        </Gauge>,
      );
      await act(async () => jest.advanceTimersByTime(3000));
      expect(screen.getByText('80')).toBeOnTheScreen();
      expect(onSettled).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('bar list draws each bar with its benchmark', async () => {
    await show(
      <BarList
        testID="bars"
        benchmark={0.5}
        data={[
          { key: 'a', label: 'Alpha', ratio: 0.9, valueLabel: '90%', caption: '9/10', highlight: true },
          { key: 'b', label: 'Bravo', ratio: 0.2, valueLabel: '20%', tone: 'danger' },
          { key: 'c', label: 'Charlie', ratio: 0.6, valueLabel: '60%', tone: 'success' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Alpha 90%')).toBeOnTheScreen();
    expect(screen.getByText('9/10')).toBeOnTheScreen();
  });

  it('trend chart waits for its width, then draws series, labels and the last value', async () => {
    await show(
      <TrendChart
        testID="chart"
        labels={['Jan', 'Feb', 'Mar']}
        formatValue={(value) => `${Math.round(value * 100)}%`}
        series={[
          { key: 'a', label: 'A', values: [0.4, 0.5, 0.6], color: '#00f', area: true },
          { key: 'b', label: 'B', values: [0.3, 0.35, 0.4], color: '#999', dashed: true },
        ]}
      />,
    );
    await fireEvent(screen.getByTestId('chart'), 'layout', { nativeEvent: { layout: { width: 300, height: 170, x: 0, y: 0 } } });
    expect(await screen.findByText('Jan')).toBeOnTheScreen();
    expect(screen.getByText('60%')).toBeOnTheScreen();
  });

  it('reveals the plot with a fade (a clip-path reveal stayed empty on Android)', async () => {
    jest.useFakeTimers();
    try {
      await show(<TrendChart testID="chart" series={[{ key: 'a', label: 'A', values: [0.4, 0.6], color: '#00f' }]} />);
      await fireEvent(screen.getByTestId('chart'), 'layout', { nativeEvent: { layout: { width: 300, height: 170, x: 0, y: 0 } } });
      expect(screen.getByTestId('chart-plot')).toHaveAnimatedStyle({ opacity: 0 });
      await act(async () => jest.advanceTimersByTime(1200));
      expect(screen.getByTestId('chart-plot')).toHaveAnimatedStyle({ opacity: 1 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('smooth path handles empty, single and multi-point series', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M 1 2');
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toMatch(/^M 0 0 C/);
  });

  it('QR code encodes a value into a square module matrix and one svg path', async () => {
    const matrix = qrMatrix('PITLANE-CHECKIN-123');
    expect(matrix.size).toBeGreaterThan(20);
    const dark = Array.from({ length: matrix.size ** 2 }, (_, index) => matrix.isDark(Math.floor(index / matrix.size), index % matrix.size)).filter(Boolean).length;
    expect(dark).toBeGreaterThan(50);
    expect(qrPath(matrix).startsWith('M')).toBe(true);
    await show(<QrCode value="PITLANE-CHECKIN-123" testID="qr" />);
    expect(screen.getByLabelText('PITLANE-CHECKIN-123')).toBeOnTheScreen();
  });
});
