<script lang="ts">
	let { size = 28 }: { size?: number } = $props();
</script>

<!-- Vinyl postmark: an inked record with postmark waves running off its edge. -->
<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	fill="none"
	stroke-linecap="round"
	aria-hidden="true"
>
	<g stroke="var(--stamp)" stroke-width="3.2">
		<path d="M34 21 q4 -3.5 8 0 t8 0 t8 0" />
		<path d="M34 32 q4 -3.5 8 0 t8 0 t8 0" />
		<path d="M34 43 q4 -3.5 8 0 t8 0 t8 0" />
	</g>
	<circle cx="23" cy="32" r="20" fill="var(--stamp)" />
	<g stroke="var(--card)" stroke-width="1.1" opacity=".55">
		<circle cx="23" cy="32" r="16.5" />
		<circle cx="23" cy="32" r="13.5" />
		<circle cx="23" cy="32" r="10.5" />
	</g>
	<circle cx="23" cy="32" r="6.5" fill="var(--card)" />
	<circle cx="23" cy="32" r="1.6" fill="var(--stamp)" />
	<path d="M12 20 a16 16 0 0 1 9 -4.3" stroke="var(--card)" stroke-width="1.6" opacity=".9" />
</svg>
