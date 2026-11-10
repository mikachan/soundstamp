<script lang="ts">
	import type { Destination } from '../passport/types';

	let {
		destinations,
		onchange
	}: { destinations: Destination[]; onchange?: (destination: Destination | undefined) => void } =
		$props();

	let index = $state(0);
	// Destinations can shrink as stamping continues; keep the index in range.
	let current = $derived(destinations[index % Math.max(destinations.length, 1)]);

	$effect(() => {
		onchange?.(current);
	});
</script>

<section class="destination" aria-labelledby="destination-heading">
	<h2 id="destination-heading" class="visually-hidden">Next destination</h2>
	{#if current}
		<div class="pass">
			<div class="main">
				<p class="label">Boarding pass · next destination</p>
				<p class="route" aria-hidden="true">
					<span class="from">You</span>
					<span class="flight">✈ ─────</span>
					<span class="code">{current.country}</span>
				</p>
				<p class="country">{current.countryName}</p>
				<dl>
					<div>
						<dt class="label">Artist</dt>
						<dd>{current.artist.name}</dd>
					</div>
					<div>
						<dt class="label">Why</dt>
						<dd>Because you like {current.becauseOf}</dd>
					</div>
				</dl>
			</div>
			<div class="stub">
				<a class="button" href={current.artist.url} aria-label="Listen to {current.artist.name} on last.fm"
					>Listen on last.fm</a
				>
				{#if destinations.length > 1}
					<button class="button ghost" onclick={() => (index = (index + 1) % destinations.length)}>
						Show me another
					</button>
					<p class="count">{(index % destinations.length) + 1} of {destinations.length}</p>
				{/if}
			</div>
		</div>
	{:else}
		<p class="empty">
			✈ <strong>Next destination</strong><br />No suggestion yet. Check back once more of your passport
			is stamped.
		</p>
	{/if}
</section>

<style>
	.destination {
		margin-block: 1.5rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.pass {
		display: flex;
		flex-wrap: wrap;
		border: 1px solid var(--rule);
		border-radius: 0.9rem;
		background: var(--card);
		overflow: hidden;
	}
	.main {
		flex: 1 1 18rem;
		padding: 1.1rem 1.3rem;
	}
	.stub {
		flex: 0 1 11rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		padding: 1.1rem;
		border-left: 2px dashed var(--rule);
		text-align: center;
	}
	@media (max-width: 34rem) {
		.stub {
			flex-basis: 100%;
			border-left: 0;
			border-top: 2px dashed var(--rule);
		}
	}
	p,
	dl,
	dd {
		margin: 0;
	}
	.label {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	.route {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-top: 0.4rem;
		color: var(--stamp);
	}
	.from {
		font: 600 0.85rem/1 var(--font-display);
		text-transform: uppercase;
		color: var(--muted);
	}
	.code {
		font: 700 2rem/1 var(--font-display);
	}
	.country {
		font: 700 1.4rem/1.2 var(--font-display);
		margin-top: 0.2rem;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.6rem;
		margin-top: 0.8rem;
	}
	dd {
		font-weight: 600;
	}
	.button {
		display: block;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--stamp);
		border-radius: 0.5rem;
		background: var(--stamp);
		color: var(--card);
		font: 600 0.9rem/1.2 var(--font-body);
		text-decoration: none;
		cursor: pointer;
	}
	.button.ghost {
		background: transparent;
		color: var(--stamp);
	}
	.count {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.empty {
		padding: 1rem 1.25rem;
		border-left: 4px solid var(--stamp);
		border-radius: 0.5rem;
		background: var(--card);
	}
</style>
