import { redirect } from '@sveltejs/kit';
import { renderCardSvg } from '#lib/server/og/card.js';
import { cardPng } from '#lib/server/og/png.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	// One address, so the CDN cache can't be bypassed with query strings.
	if (url.search) redirect(301, '/og.png');
	return new Response(new Uint8Array(cardPng(renderCardSvg({}))), {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
	});
};
