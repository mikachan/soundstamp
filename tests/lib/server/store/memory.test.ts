import { expect, test } from 'vitest';
import { memoryKV } from '#lib/server/store/types';

test('memoryKV round-trips get, set, delete and list', async () => {
	const kv = memoryKV<{ n: number }>();
	expect(await kv.get('a')).toBeNull();
	await kv.set('a', { n: 1 });
	await kv.set('b', { n: 2 });
	expect(await kv.get('a')).toEqual({ n: 1 });
	expect((await kv.list()).sort()).toEqual(['a', 'b']);
	await kv.delete('a');
	expect(await kv.get('a')).toBeNull();
	expect(await kv.list()).toEqual(['b']);
});

test('memoryKV stores copies, not references', async () => {
	const kv = memoryKV<{ n: number }>();
	const value = { n: 1 };
	await kv.set('a', value);
	value.n = 99;
	expect(await kv.get('a')).toEqual({ n: 1 });
});
