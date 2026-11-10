import { renderCardSvg } from '#lib/server/og/card.js';
import { cardPng } from '#lib/server/og/png.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(new Uint8Array(cardPng(renderCardSvg({}))), {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
	});
