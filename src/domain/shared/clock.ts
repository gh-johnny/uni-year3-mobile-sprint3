export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for tests and for the reproducible demo dataset. */
export class FixedClock implements Clock {
  private constructor(private current: Date) {}

  static at(isoDate: string | Date): FixedClock {
    return new FixedClock(new Date(isoDate));
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * DAY_MS);
  }
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export const Dates = {
  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY_MS);
  },
  addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  },
  daysBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
  },
  monthsBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / (DAY_MS * 30.4375);
  },
  startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  },
  isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  },
} as const;
