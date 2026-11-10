import { createHash } from 'node:crypto';

const MAX_KEY_BYTES = 500; // Netlify Blobs rejects keys over 600 UTF-8 bytes.
const HASHED = /^h:[0-9a-f]{64}$/;

/** A valid blob key for `key`: URI-encoded, or a stable hash when that would be too long. */
export function blobKey(key: string): string {
	if (HASHED.test(key)) return key;
	const encoded = encodeURIComponent(key);
	if (new TextEncoder().encode(encoded).length <= MAX_KEY_BYTES) return encoded;
	return `h:${createHash('sha256').update(key).digest('hex')}`;
}

/** Inverse of blobKey for listing. Hashed keys come back as-is (blobKey accepts them). */
export function fromBlobKey(stored: string): string {
	return HASHED.test(stored) ? stored : decodeURIComponent(stored);
}
