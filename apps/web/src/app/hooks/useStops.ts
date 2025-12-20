import { useEffect, useState } from "react";

import { GTFS_BASE } from "@/constants/endpoints";
import type { BusStop } from "@/types/transport";

const COORD_ROUNDING_FACTOR = 100000;

type StopsState = {
	stops: BusStop[];
	loading: boolean;
	error: string | null;
};

export function useStops(): StopsState {
	const [state, setState] = useState<StopsState>({
		stops: [],
		loading: true,
		error: null,
	});

	useEffect(() => {
		let isCancelled = false;

		fetch(`${GTFS_BASE}/stops`)
			.then((res) => res.json())
			.then((data) => {
				if (isCancelled) return;
				const stopsArray = (Object.values(data) as BusStop[]).map((stop) => ({
					...stop,
					stop_lat:
						Math.round(stop.stop_lat * COORD_ROUNDING_FACTOR) /
						COORD_ROUNDING_FACTOR,
					stop_lon:
						Math.round(stop.stop_lon * COORD_ROUNDING_FACTOR) /
						COORD_ROUNDING_FACTOR,
				}));
				setState({ stops: stopsArray, loading: false, error: null });
			})
			.catch((err) => {
				console.error("Failed to fetch bus stops:", err);
				if (isCancelled) return;
				setState({
					stops: [],
					loading: false,
					error: err instanceof Error ? err.message : "Failed to fetch stops",
				});
			});

		return () => {
			isCancelled = true;
		};
	}, []);

	return state;
}
