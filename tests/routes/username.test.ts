import { describe, expect, test } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { load } from '../../src/routes/[username]/+page.server';
import { actions } from '../../src/routes/+page.server';
import { LastfmPrivateProfile, LastfmUnavailable } from '#lib/server/lastfm/client';
import { artist } from '../lib/passport/fixtures';
import { fakeDeps, fakeLastfm, fakeMusicBrainz } from '../lib/server/fakes';
import type { StampingDeps } from '#lib/server/stamping';

function deps(opts: Parameters<typeof fakeLastfm>[0] = {}) {
	const clock = { t: 0 };
	return fakeDeps(fakeLastfm(opts).client, fakeMusicBrainz({}, clock).client, clock);
}

async function caught(fn: () => Promise<unknown>) {
	try {
		await fn();
	} catch (e) {
		return e;
	}
	throw new Error('expected a throw');
}

const event = (username: string, d: StampingDeps, search = '') =>
	({
		params: { username },
		url: new URL(`http://localhost/${encodeURIComponent(username)}${search}`),
		locals: { deps: d }
	}) as unknown as Parameters<typeof load>[0];

describe('/[username] load', () => {
	test('returns a (partial) passport', async () => {
		const d = deps({ name: 'rj', artists: [artist('Boris', 10)] });
		const data = await load(event('rj', d));
		expect(data.passport.username).toBe('rj');
		expect(data.passport.pendingArtists).toBe(1);
	});

	test('reports remaining work including destination candidates', async () => {
		const d = deps({
			name: 'rj',
			artists: [artist('Boris', 10, 'bo')],
			similar: { Boris: [{ name: 'Ghost', mbid: 'gh', match: 0.5, url: 'u' }] }
		});
		await d.artists.set('mbid:bo', { country: 'JP', resolvedAt: 0 });
		const data = await load(event('rj', d));
		expect(data.passport.pendingArtists).toBe(0);
		expect(data.remaining).toBe(1);
	});

	test('uses the period from the URL, defaulting to 12 months', async () => {
		const d = deps({ name: 'rj' });
		expect((await load(event('rj', d))).period).toBe('12month');
		expect((await load(event('rj', d, '?period=overall'))).period).toBe('overall');
		expect((await load(event('rj', d, '?period=nonsense'))).period).toBe('12month');
	});

	test('the canonical-name redirect keeps the period', async () => {
		const e = await caught(() => load(event('RJ', deps({ name: 'rj' }), '?period=3month')));
		expect(isRedirect(e) && e.location).toBe('/rj?period=3month');
	});

	test('redirects to the canonical username', async () => {
		const d = deps({ name: 'rj' });
		const e = await caught(() => load(event('RJ', d)));
		expect(isRedirect(e) && e.status === 301 && e.location === '/rj').toBe(true);
	});

	test('canonical names with spaces resolve without redirecting', async () => {
		const d = deps({ name: 'Some One' });
		const data = await load(event('Some One', d));
		expect(data.passport.username).toBe('Some One');
	});

	test('unknown users get a friendly 404', async () => {
		const e = await caught(() => load(event('nobody', deps({ missing: true }))));
		expect(isHttpError(e, 404) && e.body.message).toBe('No last.fm user called "nobody"');
	});

	test('private profiles get a friendly 403', async () => {
		const d = deps({ name: 'shy' });
		d.lastfm.getTopArtists = async () => {
			throw new LastfmPrivateProfile('private');
		};
		const e = await caught(() => load(event('shy', d)));
		expect(isHttpError(e, 403) && e.body.message).toBe(
			"shy's last.fm listening history is private, so there's nothing to stamp"
		);
	});

	test('last.fm outages get a 503', async () => {
		const d = deps();
		d.lastfm.getUser = async () => {
			throw new LastfmUnavailable('down');
		};
		const e = await caught(() => load(event('rj', d)));
		expect(isHttpError(e, 503) && e.body.message).toBe('last.fm is not responding, try again shortly');
	});
});

describe('home form', () => {
	const submit = (value: string, period?: string) => {
		const body = new FormData();
		body.set('username', value);
		if (period) body.set('period', period);
		const request = new Request('http://localhost/', { method: 'POST', body });
		return actions.default({ request } as unknown as Parameters<typeof actions.default>[0]);
	};

	test('trims the name and redirects to its passport', async () => {
		const e = await caught(() => submit('  Some One '));
		expect(isRedirect(e) && e.location).toBe('/Some%20One');
	});

	test('adds the chosen period to the URL unless it is the default', async () => {
		const e1 = await caught(() => submit('rj', 'overall'));
		expect(isRedirect(e1) && e1.location).toBe('/rj?period=overall');
		const e2 = await caught(() => submit('rj', '12month'));
		expect(isRedirect(e2) && e2.location).toBe('/rj');
	});

	test('rejects an empty name with 400', async () => {
		const result = await submit('   ');
		expect(result).toMatchObject({ status: 400 });
	});
});
