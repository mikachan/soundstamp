import { toNumericId } from '../../geo/countries';
import { shade } from '../../geo/shade';
import { MAP_HEIGHT, MAP_WIDTH, worldShapes } from '../../geo/world';
import { periodLabel, type Period } from '../../passport/periods';
import type { Passport } from '../../passport/types';

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = '#f6f1e7';
const CARD = '#fffaf0';
const INK = '#12403f';
const MUTED = '#5b6a68';
const STAMP = '#b23a2e';
const LAND = '#e4dbc9';
const FONT = 'DM Serif Display';

const escape = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The vinyl postmark logo, as in Logo.svelte, with literal colours.
const logo = `<g stroke-linecap="round" fill="none">
	<g stroke="${STAMP}" stroke-width="3.2">
		<path d="M34 21 q4 -3.5 8 0 t8 0 t8 0"/><path d="M34 32 q4 -3.5 8 0 t8 0 t8 0"/><path d="M34 43 q4 -3.5 8 0 t8 0 t8 0"/>
	</g>
	<circle cx="23" cy="32" r="20" fill="${STAMP}"/>
	<g stroke="${CARD}" stroke-width="1.1" opacity=".55">
		<circle cx="23" cy="32" r="16.5"/><circle cx="23" cy="32" r="13.5"/><circle cx="23" cy="32" r="10.5"/>
	</g>
	<circle cx="23" cy="32" r="6.5" fill="${CARD}"/><circle cx="23" cy="32" r="1.6" fill="${STAMP}"/>
</g>`;

function map(passport?: Passport): string {
	const stamps = passport?.stamps ?? [];
	const byId = new Map(stamps.map((s) => [toNumericId(s.country), s]));
	const maxShare = Math.max(0, ...stamps.map((s) => s.share));
	return worldShapes
		.map((shape) => {
			const stamp = shape.id ? byId.get(shape.id) : undefined;
			return stamp
				? `<path d="${shape.d}" fill="${INK}" fill-opacity="${shade(stamp.share, maxShare).toFixed(3)}" data-country="${stamp.country}"/>`
				: `<path d="${shape.d}" fill="${LAND}"/>`;
		})
		.join('');
}

/** A 1200×630 link-preview card: a passport's stats and map, or the homepage card without one. */
export function renderCardSvg(opts: { passport?: Passport; period?: Period }): string {
	const { passport, period } = opts;
	const text = (x: number, y: number, size: number, fill: string, content: string) =>
		`<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}">${escape(content)}</text>`;

	const lines = passport
		? [
				text(64, 250, 64, INK, passport.username),
				text(64, 310, 30, MUTED, `${plural(passport.countryCount, 'country', 'countries')} · ${plural(passport.continentCount, 'continent', 'continents')}`),
				text(64, 352, 26, MUTED, periodLabel(period ?? '12month')),
				text(64, 430, 26, STAMP, passport.stamps.slice(0, 3).map((s) => s.countryName).join(' · '))
			]
		: [
				text(64, 250, 58, INK, 'How far does your'),
				text(64, 316, 58, INK, 'music travel?'),
				text(64, 380, 26, MUTED, 'Every country in your last.fm history.')
			];

	const scale = 0.72;
	const mapX = WIDTH - MAP_WIDTH * scale - 40;
	const mapY = HEIGHT - MAP_HEIGHT * scale - 60;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>
<g transform="translate(${mapX} ${mapY}) scale(${scale})" stroke="${PAPER}" stroke-width="0.6">${map(passport)}</g>
<g transform="translate(64 56) scale(1.1)">${logo}</g>
${text(150, 104, 40, STAMP, 'Soundstamp')}
${lines.join('\n')}
${text(64, 580, 22, MUTED, 'soundstamp.sekai.co.uk')}
</svg>`;
}
