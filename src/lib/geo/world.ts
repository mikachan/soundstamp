import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const countries = feature(topology, topology.objects.countries).features;
const path = geoPath(
	geoEqualEarth().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: 'FeatureCollection', features: countries })
);

/** Country outlines projected into a MAP_WIDTH × MAP_HEIGHT box. `id` is the ISO numeric code, when the atlas has one. */
export const worldShapes = countries.map((c, i) => ({
	key: c.id ? String(c.id) : `unnamed-${i}`,
	id: c.id === undefined ? undefined : String(c.id),
	name: c.properties.name,
	d: path(c) ?? ''
}));
