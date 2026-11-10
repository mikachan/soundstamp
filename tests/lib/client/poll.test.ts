import { expect, test } from 'vitest';
import { startPolling } from '#lib/client/poll';
import { passport } from '../passport/passport-fixture';

type Reply = { status: 'ok' | 'queued' | 'unavailable'; remaining: number } | 'network' | 500;

function harness(replies: Reply[]) {
	const urls: string[] = [];
	const sleeps: number[] = [];
	const updates: { pending: number; status: string }[] = [];
	let i = 0;
	const fetch = (async (url: string, init?: RequestInit) => {
		urls.push(`${init?.method} ${url}`);
		const reply = replies[Math.min(i++, replies.length - 1)];
		if (reply === 'network') throw new TypeError('offline');
		if (reply === 500) return new Response('{}', { status: 500 });
		return Response.json({ ...reply, passport: passport({ pendingArtists: reply.remaining }) });
	}) as typeof globalThis.fetch;
	const poller = startPolling({
		username: 'Some One',
		fetch,
		sleep: async (ms) => {
			sleeps.push(ms);
		},
		onUpdate: (p, status) => updates.push({ pending: p.pendingArtists, status })
	});
	return { poller, urls, sleeps, updates };
}

test('keeps posting while work remains and stops at remaining 0', async () => {
	const h = harness([
		{ status: 'ok', remaining: 2 },
		{ status: 'ok', remaining: 1 },
		{ status: 'ok', remaining: 0 }
	]);
	await h.poller.done;
	expect(h.urls).toEqual(Array(3).fill('POST /api/Some%20One/stamp'));
	expect(h.updates.map((u) => u.pending)).toEqual([2, 1, 0]);
	expect(h.sleeps).toEqual([]);
});

test('waits 3 s while queued', async () => {
	const h = harness([
		{ status: 'queued', remaining: 2 },
		{ status: 'ok', remaining: 0 }
	]);
	await h.poller.done;
	expect(h.sleeps).toEqual([3000]);
	expect(h.updates[0].status).toBe('queued');
});

test('backs off exponentially to 30 s on failures, and resets after ok', async () => {
	const h = harness([
		{ status: 'unavailable', remaining: 5 },
		'network',
		500,
		{ status: 'unavailable', remaining: 5 },
		{ status: 'unavailable', remaining: 5 },
		{ status: 'unavailable', remaining: 5 },
		{ status: 'ok', remaining: 4 },
		'network',
		{ status: 'ok', remaining: 0 }
	]);
	await h.poller.done;
	expect(h.sleeps).toEqual([3000, 6000, 12000, 24000, 30000, 30000, 3000]);
});

test('stop() halts the loop', async () => {
	const h = harness([{ status: 'queued', remaining: 3 }]);
	h.poller.stop();
	await h.poller.done;
	expect(h.urls.length).toBeLessThanOrEqual(1);
});
