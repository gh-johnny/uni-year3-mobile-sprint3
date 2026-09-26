import { getLocales } from 'expo-localization';

import { Money } from '@/domain/shared/money';
import { Percentage } from '@/domain/shared/percentage';

import { deviceLocale, Formatters, resolveLocale, Translator } from '.';
import { en } from './dictionaries/en';
import { ptBR } from './dictionaries/pt-br';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

const leaves = (node: object, prefix = ''): string[] =>
  Object.entries(node).flatMap(([key, value]) => (typeof value === 'string' ? [`${prefix}${key}`] : leaves(value as object, `${prefix}${key}.`)));

describe('Translator', () => {
  const en_ = Translator.for('en');
  const pt = Translator.for('pt-BR');

  it('translates, interpolates and falls back to the key', () => {
    expect(en_.t('common.appName')).toBe('Pitlane');
    expect(en_.t('greeting.morning', { name: 'Ana' })).toBe('Good morning, Ana');
    expect(pt.t('greeting.morning', { name: 'Ana' })).toBe('Bom dia, Ana');
    expect(en_.t('common.km', {})).toBe('{{value}} km');
    expect(en_.t('nope.missing' as never)).toBe('nope.missing');
  });

  it('picks plural forms per language (pt-BR treats 0 as singular)', () => {
    expect(en_.t('garage.vehicleCount', { count: 1 })).toBe('1 vehicle');
    expect(en_.t('garage.vehicleCount', { count: 0 })).toBe('0 vehicles');
    expect(pt.t('garage.vehicleCount', { count: 0 })).toBe('0 veículo');
    expect(pt.t('garage.vehicleCount', { count: 2 })).toBe('2 veículos');
    expect(pt.pluralCategory(1.5)).toBe('other');
  });

  it('resolves domain error codes with a generic fallback', () => {
    expect(en_.error('auth.locked', { seconds: 30 })).toBe('Too many attempts. Try again in 30 s.');
    expect(en_.error('who.knows')).toBe(en.common.unknownError);
  });

  it('resolves keys that themselves contain dots', () => {
    expect(en_.has('sync.types.appointment.booked')).toBe(true);
    expect(en_.has('sync.types')).toBe(false);
    expect(en_.has('sync.nothing')).toBe(false);
  });

  it('falls back to English for an unregistered locale', () => {
    expect(Translator.for('xx' as never).t('common.appName')).toBe('Pitlane');
  });

  it('keeps pt-BR and en in lockstep (same keys)', () => {
    expect(leaves(ptBR).sort()).toEqual(leaves(en).sort());
  });
});

describe('locale detection', () => {
  it('follows the device language and defaults to English', () => {
    jest.mocked(getLocales).mockReturnValue([{ languageCode: 'pt' }] as never);
    expect(deviceLocale()).toBe('pt-BR');
    expect(resolveLocale('system')).toBe('pt-BR');
    expect(resolveLocale('en')).toBe('en');
    jest.mocked(getLocales).mockReturnValue([{ languageCode: 'fr' }] as never);
    expect(deviceLocale()).toBe('en');
    jest.mocked(getLocales).mockReturnValue([] as never);
    expect(deviceLocale()).toBe('en');
    jest.mocked(getLocales).mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(deviceLocale()).toBe('en');
  });
});

describe('Formatters', () => {
  const f = Formatters.for('en');
  const br = Formatters.for('pt-BR');
  const now = new Date(2026, 8, 25, 10, 0);

  it('caches one instance per locale', () => {
    expect(Formatters.for('en')).toBe(f);
    expect(br).not.toBe(f);
  });

  it('formats numbers, percentages and signed point deltas', () => {
    expect(f.number(1234.5, 1)).toBe('1,234.5');
    expect(br.number(1234.5, 1)).toBe('1.234,5');
    expect(f.percent(0.629)).toBe('63%');
    expect(f.percent(Percentage.ofRatio(0.5), 1)).toBe('50.0%');
    expect(f.signedPoints(6.4)).toBe('+6.4');
    expect(f.signedPoints(-3.14159)).toBe('−3.1');
    expect(f.signedPoints(0)).toBe('0.0');
  });

  it('formats money and distances', () => {
    expect(br.currency(Money.brl(1234.5))).toContain('1.234,50');
    expect(f.currency(Money.brl(90), 0)).toContain('90');
    expect(f.compactCurrency(Money.brl(17100))).toMatch(/17/);
    expect(f.km(12345.6)).toBe('12,346 km');
    expect(f.distance(2.94)).toBe('2.9 km');
    expect(f.distance(14.2)).toBe('14 km');
  });

  it('formats dates and times', () => {
    expect(f.time(new Date(2026, 8, 5, 7, 5))).toBe('07:05');
    expect(f.date(now, 'short')).toMatch(/09/);
    expect(f.date(now)).toMatch(/2026/);
    expect(f.date(now, 'long')).toMatch(/September/);
    expect(br.date(now, 'long')).toMatch(/setembro/);
    expect(f.weekday(now)).toBe('Fri');
    expect(f.month(now)).toBe('Sep');
  });

  it('describes relative time in days and months', () => {
    const day = (offset: number) => new Date(2026, 8, 25 + offset, 12);
    expect(f.relative(day(0), now)).toBe('Today');
    expect(f.relative(day(1), now)).toBe('Tomorrow');
    expect(f.relative(day(5), now)).toBe('in 5 days');
    expect(f.relative(day(-3), now)).toBe('3 days ago');
    expect(f.relative(day(90), now)).toBe('in 3 months');
    expect(f.relative(day(-200), now)).toBe('7 months ago');
    expect(br.relative(day(-1), now)).toBe('há 1 dia');
  });

  it('never throws when Intl is unavailable', () => {
    const numberFormat = Intl.NumberFormat;
    const dateFormat = Intl.DateTimeFormat;
    Intl.NumberFormat = (() => {
      throw new RangeError('no ICU');
    }) as never;
    Intl.DateTimeFormat = (() => {
      throw new RangeError('no ICU');
    }) as never;
    try {
      const fresh = Formatters.for('en');
      expect(fresh.number(3.14159, 2)).toBe('3.14');
      expect(fresh.currency(Money.brl(10))).toBe('R$ 10.00');
      expect(fresh.compactCurrency(Money.brl(17100))).toBe('R$ 17.1k');
      expect(fresh.date(now)).toBe('2026-09-25');
      expect(fresh.weekday(now)).toBe('5');
      expect(fresh.month(now)).toBe('9');
    } finally {
      Intl.NumberFormat = numberFormat;
      Intl.DateTimeFormat = dateFormat;
    }
  });
});
