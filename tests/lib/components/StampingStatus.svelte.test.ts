import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StampingStatus from '#lib/components/StampingStatus.svelte';
import { passport } from '../passport/passport-fixture';

describe('StampingStatus', () => {
	test('shows rounded progress while not ready', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ ready: false, coverage: 0.426, pendingArtists: 40 }),
			status: 'ok'
		});
		expect(container).toHaveTextContent('Stamping your passport… 43%');
	});

	test('shows remaining artists once ready', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ ready: true, coverage: 0.95, pendingArtists: 12 }),
			status: 'ok'
		});
		expect(container).toHaveTextContent('Still stamping: 12 artists to go');
	});

	test('shows the queue message when busy', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ ready: false, coverage: 0.1, pendingArtists: 80 }),
			status: 'queued'
		});
		expect(container).toHaveTextContent("Busy right now, you're in the queue");
	});

	test('shows nothing when finished with no unknown artists', () => {
		const { container } = render(StampingStatus, { passport: passport(), status: null });
		expect(container.textContent?.trim()).toBe('');
	});

	test('counts artists without a known home country', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ unknownArtists: 7 }),
			status: null
		});
		expect(container).toHaveTextContent('7 artists without a known home country');
	});
});

describe('first-visit note', () => {
	test('explains why stamping takes a while and that progress is saved', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ ready: false, coverage: 0.2, pendingArtists: 300 }),
			status: 'ok'
		});
		expect(container).toHaveTextContent(
			'Your first visit can take a few minutes. Your progress is saved, so you can leave and come back.'
		);
		expect(container).not.toHaveTextContent('one lookup a second');
	});

	test('is hidden once the passport is ready', () => {
		const { container } = render(StampingStatus, {
			passport: passport({ ready: true, coverage: 0.95, pendingArtists: 12 }),
			status: 'ok'
		});
		expect(container).not.toHaveTextContent('first visit');
	});
});

describe('progress bar', () => {
	test('stays visible after the passport is ready, until every artist is stamped', () => {
		render(StampingStatus, {
			passport: passport({ ready: true, coverage: 0.95, pendingArtists: 12 }),
			status: 'ok'
		});
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '95');
	});

	test('disappears once everything is stamped', () => {
		render(StampingStatus, { passport: passport({ pendingArtists: 0, unknownArtists: 2 }), status: null });
		expect(screen.queryByRole('progressbar')).toBeNull();
	});
});
