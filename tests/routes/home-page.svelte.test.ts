import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Home from '../../src/routes/+page.svelte';

test('home page uses the "how far does your music travel" wording', () => {
	const { container } = render(Home, { form: null, data: { ogImage: 'https://x/og.png' } } as never);
	expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How far does your music travel?');
	expect(container).toHaveTextContent(
		"A map of every country in your last.fm history, a stamp for each one, and one place you haven't been yet."
	);
	expect(screen.getByRole('button')).toHaveTextContent('Open my passport');
});
