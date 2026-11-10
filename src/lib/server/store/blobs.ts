import { getStore } from '@netlify/blobs';
import type { KV } from './types';

/** Netlify Blobs-backed KV. Keys are URI-encoded so artist names are always valid blob keys. */
export function blobsKV<T>(storeName: 'artists' | 'snapshots' | 'meta'): KV<T> {
	const store = getStore({ name: storeName, consistency: 'strong' });
	return {
		async get(key) {
			return ((await store.get(encodeURIComponent(key), { type: 'json' })) as T | null) ?? null;
		},
		async set(key, value) {
			await store.setJSON(encodeURIComponent(key), value);
		},
		async delete(key) {
			await store.delete(encodeURIComponent(key));
		},
		async list() {
			const { blobs } = await store.list();
			return blobs.map((b) => decodeURIComponent(b.key));
		}
	};
}
