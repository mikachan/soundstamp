export interface KV<T> {
	get(key: string): Promise<T | null>;
	set(key: string, value: T): Promise<void>;
	delete(key: string): Promise<void>;
	list(): Promise<string[]>;
}

/** A resolved artist. `country` is null when MusicBrainz has no usable country. */
export interface ArtistRecord {
	country: string | null;
	resolvedAt: number;
	/**
	 * Whether MusicBrainz has several artists with this name. Only checked for
	 * next-destination candidates; undefined means not checked yet.
	 */
	sharedName?: boolean;
}

export function memoryKV<T>(): KV<T> {
	const data = new Map<string, T>();
	return {
		async get(key) {
			const value = data.get(key);
			return value === undefined ? null : structuredClone(value);
		},
		async set(key, value) {
			data.set(key, structuredClone(value));
		},
		async delete(key) {
			data.delete(key);
		},
		async list() {
			return [...data.keys()];
		}
	};
}
