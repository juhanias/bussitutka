import { useCallback, useRef, useState } from "react";

import { GTFS_BASE } from "../constants/endpoints";
import type { Departure, ShapePoint, Trip } from "../types/transport";

export interface RouteShape {
	coords: [number, number][];
	lineref: string;
}

export function useRouteShapes() {
	const [routeShapes, setRouteShapes] = useState<RouteShape[]>([]);
	const shapeCacheRef = useRef<Map<string, [number, number][]>>(new Map());

	const loadRoutes = useCallback(async (departures: Departure[]) => {
		if (!departures.length) {
			setRouteShapes([]);
			return;
		}

		// map destination to { tripRef, lineref }
		const uniqueTrips = new Map<string, { tripRef: string; lineref: string }>();
		for (const dep of departures) {
			if (!dep.destinationdisplay || !dep.__tripref) continue;
			if (uniqueTrips.has(dep.destinationdisplay)) continue;
			uniqueTrips.set(dep.destinationdisplay, {
				tripRef: dep.__tripref,
				lineref: dep.lineref,
			});
		}

		if (!uniqueTrips.size) {
			setRouteShapes([]);
			return;
		}

		try {
			// map shapeId to lineref
			const shapeToLineref = new Map<string, string>();
			await Promise.all(
				[...uniqueTrips.values()].map(async ({ tripRef, lineref }) => {
					try {
						const tripRes = await fetch(
							`${GTFS_BASE}/trips/trip/${encodeURIComponent(tripRef)}`,
						);
						const trips: Trip[] = await tripRes.json();
						if (trips.length > 0 && trips[0].shape_id) {
							shapeToLineref.set(trips[0].shape_id, lineref);
						}
					} catch (err) {
						console.error("Failed to fetch trip data", err);
					}
				}),
			);

			if (!shapeToLineref.size) {
				setRouteShapes([]);
				return;
			}

			const shapes: RouteShape[] = [];
			await Promise.all(
				[...shapeToLineref.entries()].map(async ([shapeId, lineref]) => {
					if (shapeCacheRef.current.has(shapeId)) {
						const coords = shapeCacheRef.current.get(shapeId);
						if (coords) {
							shapes.push({
								coords,
								lineref,
							});
						}
						return;
					}

					try {
						const shapeRes = await fetch(`${GTFS_BASE}/shapes/${shapeId}`);
						const shapePoints: ShapePoint[] = await shapeRes.json();
						const coords: [number, number][] = shapePoints.map((p) => [
							p.lon,
							p.lat,
						]);
						shapeCacheRef.current.set(shapeId, coords);
						shapes.push({
							coords,
							lineref,
						});
					} catch (err) {
						console.error("Failed to fetch shape data", err);
					}
				}),
			);

			setRouteShapes(shapes);
		} catch (err) {
			console.error("Failed to fetch routes for departures", err);
			setRouteShapes([]);
		}
	}, []);

	return { routeShapes, loadRoutes };
}
