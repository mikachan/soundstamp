<script lang="ts">
	import type { Stamp } from '../passport/types';

	let { stamps }: { stamps: Stamp[] } = $props();

	let open = $state<string | null>(null);

	// A slight, stable tilt per country so the stamps look hand-pressed.
	const tilt = (code: string) => ((code.charCodeAt(0) * 7 + code.charCodeAt(1) * 13) % 9) - 4;
</script>

<section class="stamps" aria-labelledby="stamps-heading">
	<h2 id="stamps-heading">Stamps</h2>
	<ul>
		{#each stamps as stamp (stamp.country)}
			{@const expanded = open === stamp.country}
			<li aria-label={stamp.countryName} style:--tilt="{tilt(stamp.country)}deg">
				<button
					aria-expanded={expanded}
					aria-controls="tracks-{stamp.country}"
					onclick={() => (open = expanded ? null : stamp.country)}
				>
					<span class="country">{stamp.countryName}</span>
					<span class="plays">{stamp.plays.toLocaleString('en-GB')} plays</span>
				</button>
				<ol class="artists">
					{#each stamp.artists as artist (artist.url)}
						<li><a href={artist.url}>{artist.name}</a></li>
					{/each}
				</ol>
				{#if expanded}
					<div id="tracks-{stamp.country}" class="tracks">
						<h3>Top tracks</h3>
						{#if stamp.tracks.length}
							<ol>
								{#each stamp.tracks as track (track.url)}
									<li><a href={track.url}>{track.name}</a> <span>· {track.artist}</span></li>
								{/each}
							</ol>
						{:else}
							<p>No top tracks from here yet.</p>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	h2 {
		font: 700 1.3rem/1.2 var(--font-display);
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	ul > li {
		padding: 0.9rem 1rem;
		border: 2px dashed var(--stamp);
		border-radius: 0.6rem;
		background: var(--card);
		transform: rotate(var(--tilt));
	}
	button {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--stamp);
		text-align: left;
		cursor: pointer;
	}
	.country {
		font: 700 1.1rem/1.2 var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.plays {
		font-size: 0.8rem;
		color: var(--muted);
	}
	ol {
		margin: 0.5rem 0 0;
		padding-left: 1.2rem;
		font-size: 0.9rem;
	}
	.tracks h3 {
		margin: 0.75rem 0 0;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.tracks span,
	.tracks p {
		color: var(--muted);
	}
</style>
