export function calculateBearing(
	fromLat: number,
	fromLon: number,
	toLat: number,
	toLon: number,
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const toDeg = (rad: number) => (rad * 180) / Math.PI;

	const lat1 = toRad(fromLat);
	const lat2 = toRad(toLat);
	const dLon = toRad(toLon - fromLon);

	const y = Math.sin(dLon) * Math.cos(lat2);
	const x =
		Math.cos(lat1) * Math.sin(lat2) -
		Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

	const bearing = toDeg(Math.atan2(y, x));
	return (bearing + 360) % 360;
}

export function getDistance(
	fromLat: number,
	fromLon: number,
	toLat: number,
	toLon: number,
): number {
	const dLat = toLat - fromLat;
	const dLon = toLon - fromLon;
	return Math.sqrt(dLat * dLat + dLon * dLon);
}
