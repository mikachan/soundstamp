import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Home from '../../src/routes/+page.svelte';

test('the username box asks browsers and password managers not to autofill or autocorrect', () => {
	render(Home, { form: null, data: { ogImage: 'https://x/og.png' } } as never);
	const input = screen.getByRole('textbox', { name: /username/i });
	expect(input).toHaveAttribute('autocomplete', 'off');
	expect(input).toHaveAttribute('autocapitalize', 'none');
	expect(input).toHaveAttribute('autocorrect', 'off');
	expect(input).toHaveAttribute('spellcheck', 'false');
	expect(input).toHaveAttribute('data-1p-ignore');
	expect(input).toHaveAttribute('data-lpignore', 'true');
});
