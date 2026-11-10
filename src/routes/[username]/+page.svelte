<script lang="ts">
	import { onMount } from 'svelte';
	import IdStrip from '#lib/components/IdStrip.svelte';
	import StampingStatus from '#lib/components/StampingStatus.svelte';
	import WorldMap from '#lib/components/WorldMap.svelte';
	import Stamps from '#lib/components/Stamps.svelte';
	import NextDestination from '#lib/components/NextDestination.svelte';
	import { startPolling, type StampStatus } from '#lib/client/poll.js';
	import { PERIODS, periodLabel, periodQuery } from '#lib/passport/periods.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Server data first, then live updates from the stamping loop.
	let passport = $derived(data.passport);
	let status = $state<StampStatus | null>(null);
	let empty = $derived(passport.stamps.length === 0 && passport.pendingArtists === 0);

	onMount(() => {
		// `remaining` includes next-destination candidates, which pendingArtists doesn't count.
		if (data.remaining === 0) return;
		const poller = startPolling({
			username: passport.username,
			period: data.period,
			fetch,
			sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
			onUpdate: (next, nextStatus) => {
				passport = next;
				status = nextStatus;
			},
			onError: (terminal) => {
				// A terminal error leaves the passport as it is; otherwise show that we're retrying.
				status = terminal ? null : 'unavailable';
			}
		});
		return poller.stop;
	});

	let summary = $derived(
		`${passport.countryCount} countries across ${passport.continentCount} continents, from ${passport.totalScrobbles.toLocaleString('en-GB')} scrobbles.`
	);
</script>

<svelte:head>
	<title>
		{passport.username}'s Soundstamp: {passport.countryCount} countries ({periodLabel(data.period).toLowerCase()})
	</title>
	<meta name="description" content={summary} />
	<meta property="og:title" content="{passport.username}'s Soundstamp passport" />
	<meta property="og:description" content={summary} />
</svelte:head>

<IdStrip {passport} />
<nav class="periods" aria-label="Listening period">
	{#each PERIODS as period (period)}
		<a
			href={periodQuery(period) || '?'}
			aria-current={period === data.period ? 'page' : undefined}
			data-sveltekit-reload>{periodLabel(period)}</a
		>
	{/each}
</nav>
<StampingStatus {passport} {status} />
<WorldMap stamps={passport.stamps} />
{#if empty}
	<p class="empty">
		No scrobbles to stamp yet. Listen to some music with last.fm scrobbling on, then come back.
	</p>
{:else}
	<Stamps stamps={passport.stamps} />
	<NextDestination destinations={passport.destinations} />
{/if}

<form method="POST" action="/api/{encodeURIComponent(passport.username)}/refresh{periodQuery(data.period)}" class="refresh">
	<button>Refresh from last.fm</button>
</form>

<style>
	.periods {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-block: 1rem 0;
	}
	.periods a {
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--rule);
		border-radius: 1rem;
		font-size: 0.85rem;
		color: var(--muted);
		text-decoration: none;
	}
	.periods a[aria-current='page'] {
		border-color: var(--stamp);
		background: var(--stamp);
		color: var(--card);
	}
	.empty {
		margin-block: 2rem;
		color: var(--muted);
	}
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
