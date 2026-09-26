export const AGE_BANDS = ['0-1', '1-3', '3-5', '5-8', '8+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AgeBands = {
  of(ageInYears: number): AgeBand {
    if (ageInYears < 1) return '0-1';
    if (ageInYears < 3) return '1-3';
    if (ageInYears < 5) return '3-5';
    if (ageInYears < 8) return '5-8';
    return '8+';
  },
} as const;
