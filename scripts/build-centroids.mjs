// Generates src/lib/geo/centroids.json: ISO alpha-2 → [longitude, latitude] for every
// country in world-atlas's detailed (50m) map, including islands too small for the 110m
// map we draw. Uses the centroid of each country's largest polygon, so overseas
// territories don't drag the marker into the sea. Run: node scripts/build-centroids.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoArea, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const iso = require('i18n-iso-countries');
const world = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8'));

const centroids = {};
for (const country of feature(world, world.objects.countries).features) {
	const code = country.id && iso.numericToAlpha2(country.id);
	if (!code) continue;
	const polygons =
		country.geometry.type === 'MultiPolygon'
			? country.geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }))
			: [country.geometry];
	const largest = polygons.reduce((a, b) => (geoArea(b) > geoArea(a) ? b : a));
	centroids[code] = geoCentroid(largest).map((n) => Math.round(n * 100) / 100);
}
writeFileSync('src/lib/geo/centroids.json', JSON.stringify(centroids) + '\n');
console.log(`wrote ${Object.keys(centroids).length} centroids`);
