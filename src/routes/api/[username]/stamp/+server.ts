import { json } from '@sveltejs/kit';
import { appDeps, rethrowAsHttp } from '#lib/server/app-deps.js';
import { stampNextBatch } from '#lib/server/stamping.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
	const result = await stampNextBatch(appDeps(locals), params.username).catch((e: unknown) =>
		rethrowAsHttp(e, params.username)
	);
	return json(result);
};
