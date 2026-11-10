/** last.fm's chart periods, shortest first. */
export const PERIODS = ['7day', '1month', '3month', '6month', '12month', 'overall'] as const;
export type Period = (typeof PERIODS)[number];

export const DEFAULT_PERIOD: Period = '12month';

const LABELS: Record<Period, string> = {
	'7day': 'Last 7 days',
	'1month': 'Last month',
	'3month': 'Last 3 months',
	'6month': 'Last 6 months',
	'12month': 'Last 12 months',
	overall: 'All time'
};

export function parsePeriod(value: string | null | undefined): Period {
	return PERIODS.includes(value as Period) ? (value as Period) : DEFAULT_PERIOD;
}

export const periodLabel = (period: Period) => LABELS[period];

/** Query string for a period; the default is left out so URLs stay short. */
export const periodQuery = (period: Period) => (period === DEFAULT_PERIOD ? '' : `?period=${period}`);
