export function normaliseName(name: string): string {
	return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function artistKey(artist: { name: string; mbid?: string }): string {
	return artist.mbid ? `mbid:${artist.mbid}` : `name:${normaliseName(artist.name)}`;
}
