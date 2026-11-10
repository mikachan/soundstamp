/** Fill opacity for a country: square-root scaled so smaller listening still shows. */
export function shade(share: number, maxShare: number): number {
	if (share <= 0 || maxShare <= 0) return 0;
	return 0.25 + 0.75 * Math.sqrt(share / maxShare);
}
