import { expect, test } from 'vitest';
import { memoryKV } from '#lib/server/store/types';
import { createThrottle, ThrottleBusy } from '#lib/server/store/throttle';

function fakeClock(start = 0) {
	let t = start;
	const sleeps: number[] = [];
	return {
		now: () => t,
		sleep: async (ms: number) => {
			sleeps.push(ms);
			t += ms;
		},
		sleeps
	};
}

test('spaces consecutive waits 1100 ms apart and advances mb-next', async () => {
	const kv = memoryKV<number>();
	const clock = fakeClock(10_000);
	const throttle = createThrottle({ kv, now: clock.now, sleep: clock.sleep });
	const started: number[] = [];
	for (let i = 0; i < 3; i++) {
		await throttle.wait();
		started.push(clock.now());
	}
	expect(started).toEqual([10_000, 11_100, 12_200]);
	expect(await kv.get('mb-next')).toBe(13_300);
});

test('does not sleep when the slot is already free', async () => {
	const kv = memoryKV<number>();
	await kv.set('mb-next', 500);
	const clock = fakeClock(10_000);
	await createThrottle({ kv, now: clock.now, sleep: clock.sleep }).wait();
	expect(clock.sleeps).toEqual([]);
});

test('throws ThrottleBusy without sleeping when the wait exceeds 2000 ms', async () => {
	const kv = memoryKV<number>();
	await kv.set('mb-next', 12_001);
	const clock = fakeClock(10_000);
	const throttle = createThrottle({ kv, now: clock.now, sleep: clock.sleep });
	await expect(throttle.wait()).rejects.toBeInstanceOf(ThrottleBusy);
	expect(clock.sleeps).toEqual([]);
	expect(await kv.get('mb-next')).toBe(12_001);
});

test('concurrent waits in one process queue up instead of sharing a slot', async () => {
	const kv = memoryKV<number>();
	let t = 10_000;
	const started: number[] = [];
	// A slow store widens the read/write race the queue must close.
	const slowKv = {
		...kv,
		get: async (k: string) => {
			await new Promise((r) => setTimeout(r, 5));
			return kv.get(k);
		}
	};
	const throttle = createThrottle({
		kv: slowKv,
		now: () => t,
		sleep: async (ms) => {
			t += ms;
		},
		maxWaitMs: 10_000
	});
	await Promise.all(
		[1, 2, 3].map(async () => {
			await throttle.wait();
			started.push(t);
		})
	);
	expect(started.sort()).toEqual([10_000, 11_100, 12_200]);
});

test('cooldown pushes the next free slot back for everyone', async () => {
	const kv = memoryKV<number>();
	const clock = fakeClock(10_000);
	const throttle = createThrottle({ kv, now: clock.now, sleep: clock.sleep, maxWaitMs: 10_000 });
	await throttle.wait();
	await throttle.cooldown(3000);
	expect(await kv.get('mb-next')).toBe(13_000);
	await throttle.wait();
	expect(clock.now()).toBe(13_000);
});
