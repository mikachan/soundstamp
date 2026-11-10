import { getStore } from '@netlify/blobs';
import { blobKey, fromBlobKey } from './blob-key';
import type { KV } from './types';

export function blobsKV<T>(storeName: 'artists' | 'snapshots' | 'records' | 'meta'): KV<T> {
	const store = getStore({ name: storeName, consistency: 'strong' });
	return {
		async get(key) {
			return ((await store.get(blobKey(key), { type: 'json' })) as T | null) ?? null;
		},
		async set(key, value) {
			await store.setJSON(blobKey(key), value);
		},
		async delete(key) {
			await store.delete(blobKey(key));
		},
		async list() {
			const { blobs } = await store.list();
			return blobs.map((b) => fromBlobKey(b.key));
		}
	};
}
