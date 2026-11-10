import { json } from '@sveltejs/kit';
import { appDeps, rethrowAsHttp } from '#lib/server/app-deps.js';
import { parsePeriod } from '#lib/passport/periods.js';
import { stampNextBatch } from '#lib/server/stamping.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, url, locals }) => {
	const period = parsePeriod(url.searchParams.get('period'));
	const result = await stampNextBatch(appDeps(locals), params.username, undefined, period).catch(
		(e: unknown) => rethrowAsHttp(e, params.username)
	);
	return json(result);
};
