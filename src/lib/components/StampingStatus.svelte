<script lang="ts">
	import type { Passport } from '../passport/types';
	import type { StampStatus } from '../client/poll';

	let { passport, status }: { passport: Passport; status: StampStatus | null } = $props();

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	let message = $derived.by(() => {
		if (passport.pendingArtists === 0) return null;
		if (status === 'queued') return "Busy right now, you're in the queue";
		if (status === 'unavailable') return 'MusicBrainz needs a breather, retrying shortly…';
		if (!passport.ready) return `Stamping your passport… ${Math.round(passport.coverage * 100)}%`;
		return `Still stamping: ${plural(passport.pendingArtists, 'artist')} to go`;
	});
</script>

{#if message || passport.unknownArtists > 0}
	<div class="status" role="status" aria-live="polite">
		{#if message}
			<p class="progress">
				<span
					class="bar"
					role="progressbar"
					aria-label="Passport stamped"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={Math.round(passport.coverage * 100)}
					style:--coverage={passport.coverage}
				></span>
				{message}
			</p>
		{/if}
		{#if message && !passport.ready}
			<p class="note">
				Your first visit can take a few minutes. Your progress is saved, so you can leave and come
				back.
			</p>
		{/if}
		{#if passport.unknownArtists > 0}
			<p class="unknown">{plural(passport.unknownArtists, 'artist')} without a known home country</p>
		{/if}
	</div>
{/if}

<style>
	.status {
		display: grid;
		gap: 0.25rem;
		margin-block: 1rem;
		font-size: 0.9rem;
	}
	p {
		margin: 0;
	}
	.progress {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: 600;
		color: var(--ink);
	}
	.bar {
		flex: 0 0 6rem;
		height: 0.4rem;
		border-radius: 1rem;
		background: linear-gradient(
			to right,
			var(--ink) calc(var(--coverage) * 100%),
			var(--rule) calc(var(--coverage) * 100%)
		);
	}
	.unknown,
	.note {
		color: var(--muted);
	}
	.note {
		max-width: 40rem;
	}
</style>
