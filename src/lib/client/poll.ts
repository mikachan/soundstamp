import { DEFAULT_PERIOD, periodQuery, type Period } from '../passport/periods';
import type { Passport } from '../passport/types';
import type { BatchResult } from '../server/stamping';

export type StampStatus = BatchResult['status'];

const QUEUED_DELAY_MS = 3000;
const FIRST_BACKOFF_MS = 3000;
const MAX_BACKOFF_MS = 30_000;

/** Ask the server to stamp batches until nothing is left, backing off when MusicBrainz is unhappy. */
export function startPolling(opts: {
	username: string;
	period?: Period;
	fetch: typeof fetch;
	onUpdate: (passport: Passport, status: StampStatus) => void;
	/** A request failed; `terminal` means polling has stopped (4xx, e.g. the user no longer exists). */
	onError?: (terminal: boolean) => void;
	sleep: (ms: number) => Promise<void>;
}): { stop(): void; done: Promise<void> } {
	let stopped = false;
	let backoff = 0;
	const nextBackoff = () => (backoff = backoff ? Math.min(backoff * 2, MAX_BACKOFF_MS) : FIRST_BACKOFF_MS);

	async function loop() {
		while (!stopped) {
			let result: BatchResult;
			try {
				const url = `/api/${encodeURIComponent(opts.username)}/stamp${periodQuery(opts.period ?? DEFAULT_PERIOD)}`;
				const response = await opts.fetch(url, {
					method: 'POST'
				});
				if (response.status >= 400 && response.status < 500) {
					opts.onError?.(true);
					return;
				}
				if (!response.ok) throw new Error(`stamp failed: ${response.status}`);
				result = await response.json();
			} catch {
				if (stopped) return;
				opts.onError?.(false);
				await opts.sleep(nextBackoff());
				continue;
			}
			if (stopped) return;

			opts.onUpdate(result.passport, result.status);
			if (result.remaining === 0) return;
			if (result.status === 'ok') backoff = 0;
			else if (result.status === 'queued') await opts.sleep(QUEUED_DELAY_MS);
			else await opts.sleep(nextBackoff());
		}
	}

	return {
		stop: () => {
			stopped = true;
		},
		done: loop()
	};
}
