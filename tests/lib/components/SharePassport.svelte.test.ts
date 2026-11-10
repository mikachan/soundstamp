import { afterEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SharePassport from '#lib/components/SharePassport.svelte';

const props = {
	username: 'mikachan_',
	url: 'https://soundstamp.sekai.co.uk/mikachan_?period=overall',
	image: 'https://soundstamp.sekai.co.uk/mikachan_/og.png?period=overall'
};

afterEach(() => {
	vi.unstubAllGlobals();
});

test('shows the preview image and the link to share', () => {
	render(SharePassport, props);
	expect(screen.getByRole('heading', { name: 'Share your passport' })).toBeInTheDocument();
	expect(screen.getByRole('img', { name: "Preview of mikachan_'s Soundstamp passport" })).toHaveAttribute(
		'src',
		props.image
	);
	expect(screen.getByRole('textbox', { name: 'Passport link' })).toHaveValue(props.url);
});

test('copy link writes the URL to the clipboard and confirms', async () => {
	const writeText = vi.fn().mockResolvedValue(undefined);
	vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
	render(SharePassport, props);
	await fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
	expect(writeText).toHaveBeenCalledWith(props.url);
	expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
});

test('offers the system share sheet only when the browser has one', async () => {
	render(SharePassport, props);
	expect(screen.queryByRole('button', { name: 'Share…' })).toBeNull();
});

test('the share sheet gets the title and link', async () => {
	const share = vi.fn().mockResolvedValue(undefined);
	vi.stubGlobal('navigator', { ...navigator, share });
	render(SharePassport, props);
	await fireEvent.click(await screen.findByRole('button', { name: 'Share…' }));
	expect(share).toHaveBeenCalledWith({ title: "mikachan_'s Soundstamp passport", url: props.url });
});
