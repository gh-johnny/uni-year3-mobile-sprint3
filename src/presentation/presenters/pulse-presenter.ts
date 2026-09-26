import type { PulseReport } from '@/application/use-cases/advisor';
import type { ShareDimension, ShareSegment } from '@/domain/analytics/service-share-calculator';
import { VehicleModelKey, VehicleModels } from '@/domain/vehicle/vehicle-model';

import type { BarDatum, Tone } from '../design-system';
import type { I18n } from '../hooks/use-i18n';

export const PULSE_DIMENSIONS: readonly ShareDimension[] = ['dealer', 'model', 'age', 'serviceType'];

export type PulseViewModel = {
  dealerName: string;
  eyebrow: string;
  own: { value: string; progress: number; delta: string; deltaTone: Tone; retained: string; park: string };
  network: { value: string; progress: number };
  trend: { labels: string[]; own: number[]; network: number[] };
  networkAverage: number;
  breakdowns: Record<ShareDimension, BarDatum[]>;
  anomalies: { key: string; message: string; tone: Tone }[];
  trendBreak: string | null;
};

/** Presenter: the Service Share report → strings, ratios and chart series. */
export class PulsePresenter {
  static present(report: PulseReport, i18n: I18n): PulseViewModel {
    const { t, f } = i18n;
    const delta = report.own.share.points - report.network.share.points;
    const nameOf = (id: string) => report.dealers.get(id)?.name ?? id;

    const below = new Set(report.anomalies.filter((anomaly) => anomaly.direction === 'below').map((anomaly) => anomaly.key));
    const label = (dimension: ShareDimension, key: string): string => {
      if (dimension === 'dealer') return nameOf(key);
      if (dimension === 'model') return VehicleModels.get(key as VehicleModelKey).name;
      if (dimension === 'age') return t('pulse.ageBand', { band: key });
      return t(`service.${key as 'revision'}`);
    };
    const bars = (dimension: ShareDimension, segments: readonly ShareSegment[]): BarDatum[] =>
      segments.map((segment) => ({
        key: segment.key,
        label: label(dimension, segment.key),
        ratio: segment.share.ratio,
        valueLabel: f.percent(segment.share, 1),
        caption: `${f.number(segment.numerator)} / ${f.number(segment.denominator)}`,
        highlight: dimension === 'dealer' && segment.key === report.dealer.id,
        tone: dimension === 'dealer' && below.has(segment.key) ? 'danger' : undefined,
      }));

    return {
      dealerName: report.dealer.name,
      eyebrow: t('pulse.eyebrow'),
      own: {
        value: f.percent(report.own.share, 1),
        progress: report.own.share.ratio,
        delta: t('pulse.vsNetwork', { delta: f.signedPoints(delta) }),
        deltaTone: delta >= 0 ? 'success' : 'danger',
        retained: f.number(report.own.retained),
        park: f.number(report.own.park),
      },
      network: { value: f.percent(report.network.share, 1), progress: report.network.share.ratio },
      trend: {
        labels: report.ownTrend.map((point) => f.month(point.month)),
        own: report.ownTrend.map((point) => point.share.ratio),
        network: report.networkTrend.map((point) => point.share.ratio),
      },
      networkAverage: report.network.share.ratio,
      breakdowns: {
        dealer: bars('dealer', report.breakdowns.dealer),
        model: bars('model', report.breakdowns.model),
        age: bars('age', report.breakdowns.age),
        serviceType: bars('serviceType', report.breakdowns.serviceType),
      },
      anomalies: report.anomalies.map((anomaly) => ({
        key: anomaly.key,
        tone: anomaly.direction === 'below' ? 'danger' : 'success',
        message: t(anomaly.direction === 'below' ? 'pulse.anomalyBelow' : 'pulse.anomalyAbove', {
          name: nameOf(anomaly.key),
          sigma: f.number(Math.abs(anomaly.zScore), 1),
          delta: anomaly.direction === 'below' ? f.signedPoints(anomaly.deltaPoints) : f.number(Math.abs(anomaly.deltaPoints), 1),
        }),
      })),
      trendBreak: report.trendBreak ? t('pulse.trendBreak', { delta: f.signedPoints(report.trendBreak.deltaPoints) }) : null,
    };
  }
}
