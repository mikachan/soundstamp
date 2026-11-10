import { expect, test } from 'vitest';
import { isValidUsername } from '#lib/passport/username';

test.each(['rj', 'RJ', 'mikachan_', 'Big-Red_Dragon1', 'a2345678901234x'])('accepts %s', (name) => {
	expect(isValidUsername(name)).toBe(true);
});

test.each(['', 'r', '1abc', '_abc', 'Some One', 'a23456789012345x', 'wp-admin.php', '../etc', 'naïve', '<script>'])(
	'rejects %s',
	(name) => {
		expect(isValidUsername(name)).toBe(false);
	}
);
