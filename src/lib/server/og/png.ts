import { Resvg } from '@resvg/resvg-js';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import font from './DMSerifDisplay-Regular.ttf?inline';

const FONT_FAMILY = 'DM Serif Display';

/**
 * resvg only loads fonts from files, and serverless bundles can't reliably ship
 * loose files, so the font is bundled as a data URL and written to tmp on first use.
 */
function fontFile(): string {
	const path = join(tmpdir(), 'soundstamp-DMSerifDisplay-Regular.ttf');
	if (!existsSync(path)) writeFileSync(path, Buffer.from(font.slice(font.indexOf(',') + 1), 'base64'));
	return path;
}

export function cardPng(svg: string): Buffer {
	const resvg = new Resvg(svg, {
		font: { fontFiles: [fontFile()], loadSystemFonts: false, defaultFontFamily: FONT_FAMILY }
	});
	return resvg.render().asPng();
}
