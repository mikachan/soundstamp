import { describe, expect, test } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { load } from '../../src/routes/[username]/+page.server';
import { actions } from '../../src/routes/+page.server';
import { LastfmUnavailable } from '#lib/server/lastfm/client';
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

const event = (username: string, d: StampingDeps) =>
	({ params: { username }, locals: { deps: d } }) as unknown as Parameters<typeof load>[0];

describe('/[username] load', () => {
	test('returns a (partial) passport', async () => {
		const d = deps({ name: 'rj', artists: [artist('Boris', 10)] });
		const data = await load(event('rj', d));
		expect(data.passport.username).toBe('rj');
		expect(data.passport.pendingArtists).toBe(1);
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
	const submit = (value: string) => {
		const body = new FormData();
		body.set('username', value);
		const request = new Request('http://localhost/', { method: 'POST', body });
		return actions.default({ request } as unknown as Parameters<typeof actions.default>[0]);
	};

	test('trims the name and redirects to its passport', async () => {
		const e = await caught(() => submit('  Some One '));
		expect(isRedirect(e) && e.location).toBe('/Some%20One');
	});

	test('rejects an empty name with 400', async () => {
		const result = await submit('   ');
		expect(result).toMatchObject({ status: 400 });
	});
});
