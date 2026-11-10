<script lang="ts">
	import { toNumericId } from '../geo/countries';
	import { shade } from '../geo/shade';
	import { countryPoint, MAP_HEIGHT, MAP_WIDTH, worldShapes as shapes } from '../geo/world';
	import type { Stamp } from '../passport/types';

	let {
		stamps,
		destination
	}: { stamps: Stamp[]; destination?: { country: string; countryName: string } } = $props();

	let destinationPoint = $derived(destination ? countryPoint(destination.country) : null);

	let byNumericId = $derived(
		new Map(stamps.map((s) => [toNumericId(s.country), s] as const).filter(([id]) => id !== null))
	);
	let maxShare = $derived(Math.max(0, ...stamps.map((s) => s.share)));
	const percent = (share: number) => `${Math.round(share * 100)}%`;
</script>

<figure class="map">
	<svg viewBox="0 0 {MAP_WIDTH} {MAP_HEIGHT}" role="img" aria-label="World map of where your music comes from">
		{#each shapes as shape (shape.key)}
			{@const stamp = shape.id ? byNumericId.get(shape.id) : undefined}
			{#if stamp}
				<path
					d={shape.d}
					class="visited"
					data-country={stamp.country}
					fill-opacity={shade(stamp.share, maxShare)}
				>
					<title>{stamp.countryName}: {percent(stamp.share)} of your plays</title>
				</path>
			{:else}
				<path d={shape.d} class="land"><title>{shape.name}</title></path>
			{/if}
		{/each}
		{#if destination && destinationPoint}
			<g
				class="destination"
				data-destination={destination.country}
				transform="translate({destinationPoint[0].toFixed(1)} {destinationPoint[1].toFixed(1)})"
			>
				<title>Next destination: {destination.countryName}</title>
				<circle r="14" />
				<text y="-18" text-anchor="middle">✈</text>
			</g>
		{/if}
	</svg>
</figure>

<style>
	.map {
		margin: 1.5rem 0;
		padding: 0.75rem;
		border: 1px solid var(--rule);
		border-radius: 0.75rem;
		background: var(--card);
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
	}
	path {
		stroke: var(--card);
		stroke-width: 0.5;
	}
	.land {
		fill: var(--land);
	}
	.visited {
		fill: var(--visited);
	}
	.destination circle {
		fill: none;
		stroke: var(--stamp);
		stroke-width: 2.5;
		stroke-dasharray: 4 3;
	}
	.destination text {
		fill: var(--stamp);
		font-size: 18px;
	}
</style>
