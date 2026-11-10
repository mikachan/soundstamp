<script lang="ts">
	import { onMount } from 'svelte';
	import IdStrip from '#lib/components/IdStrip.svelte';
	import StampingStatus from '#lib/components/StampingStatus.svelte';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Stamps from '#lib/components/Stamps.svelte';
	import NextDestination from '#lib/components/NextDestination.svelte';
	import { startPolling, type StampStatus } from '#lib/client/poll.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Server data first, then live updates from the stamping loop.
	let passport = $derived(data.passport);
	let status = $state<StampStatus | null>(null);

	onMount(() => {
		if (passport.pendingArtists === 0) return;
		const poller = startPolling({
			username: passport.username,
			fetch,
			sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
			onUpdate: (next, nextStatus) => {
				passport = next;
				status = nextStatus;
			}
		});
		return poller.stop;
	});

	let summary = $derived(
		`${passport.countryCount} countries across ${passport.continentCount} continents, from ${passport.totalScrobbles.toLocaleString('en-GB')} scrobbles.`
	);
</script>

<svelte:head>
	<title>{passport.username}'s Soundstamp: {passport.countryCount} countries</title>
	<meta name="description" content={summary} />
	<meta property="og:title" content="{passport.username}'s Soundstamp passport" />
	<meta property="og:description" content={summary} />
</svelte:head>

<IdStrip {passport} />
<StampingStatus {passport} {status} />
<WorldMap stamps={passport.stamps} />
<Stamps stamps={passport.stamps} />
<NextDestination destinations={passport.destinations} />

<form method="POST" action="/api/{encodeURIComponent(passport.username)}/refresh" class="refresh">
	<button>Refresh from last.fm</button>
</form>

<style>
	.refresh {
		margin-block: 2rem;
	}
	.refresh button {
		padding: 0.4rem 0.9rem;
		border: 1px solid var(--rule);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}
</style>
