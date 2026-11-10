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

test('blobKey URI-encodes short keys and hashes keys that would exceed the Blobs limit', async () => {
	const { blobKey } = await import('#lib/server/store/blob-key');
	expect(blobKey('name:sigur rós')).toBe('name%3Asigur%20r%C3%B3s');
	const long = blobKey(`name:${'夜'.repeat(80)}`);
	expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(600);
	expect(long).toMatch(/^h:[0-9a-f]{64}$/);
	expect(blobKey(`name:${'夜'.repeat(80)}`)).toBe(long);
	expect(blobKey(long)).toBe(long);
});
