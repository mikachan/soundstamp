import { redirect } from '@sveltejs/kit';
import { appDeps, rethrowAsHttp } from '#lib/server/app-deps.js';
import { parsePeriod, periodQuery } from '#lib/passport/periods.js';
import { getSnapshot } from '#lib/server/stamping.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url, locals }) => {
	const period = parsePeriod(url.searchParams.get('period'));
	const snapshot = await getSnapshot(appDeps(locals), params.username, {
		refresh: true,
		period
	}).catch((e: unknown) => rethrowAsHttp(e, params.username));
	redirect(303, `/${encodeURIComponent(snapshot.username)}${periodQuery(period)}`);
};
