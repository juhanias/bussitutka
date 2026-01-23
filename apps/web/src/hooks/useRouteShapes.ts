import { useCallback, useRef, useState } from "react";

import { GTFS_SHAPES_ENDPOINT } from "../constants/endpoints";
import type { Departure } from "../types/transport";

export interface RouteShape {
	coords: [number, number][];
	lineref: string;
}

type TripShapesResponse = {
	status: "ok" | "error";
	shapes?: {
		tripId: string;
		shapeId: string;
		coords: [number, number][];
	}[];
	message?: string;
};

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
			const tripIdToLineRef = new Map<string, string>();
			for (const { tripRef, lineref } of uniqueTrips.values()) {
				tripIdToLineRef.set(tripRef, lineref);
			}

			const tripIds = Array.from(tripIdToLineRef.keys());
			const response = await fetch(GTFS_SHAPES_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tripIds }),
			});
			if (!response.ok) {
				throw new Error(`gtfs shapes responded with ${response.status}`);
			}
			const payload = (await response.json()) as TripShapesResponse;
			if (payload.status !== "ok" || !payload.shapes?.length) {
				setRouteShapes([]);
				return;
			}

			const shapes: RouteShape[] = [];
			for (const shape of payload.shapes) {
				const lineref = tripIdToLineRef.get(shape.tripId);
				if (!lineref) continue;
				const cached = shapeCacheRef.current.get(shape.shapeId);
				const coords = cached ?? shape.coords;
				if (!coords?.length) continue;
				shapeCacheRef.current.set(shape.shapeId, coords);
				shapes.push({ coords, lineref });
			}

			setRouteShapes(shapes);
		} catch (err) {
			console.error("Failed to fetch routes for departures", err);
			setRouteShapes([]);
		}
	}, []);

	return { routeShapes, loadRoutes };
}
