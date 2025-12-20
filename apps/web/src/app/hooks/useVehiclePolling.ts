import { useEffect, useRef, useState } from "react";
import { VEHICLES_ENDPOINT } from "@/constants/endpoints";
import { ANIMATION_DURATION } from "@/constants/map";
import type { Vehicle } from "@/types/transport";

type VehicleProxyResponse = {
	vehicles: Vehicle[];
	lastUpdated: number | null;
	sourceTimestamp: number | null;
	cacheSize?: number;
	stale?: boolean;
	error?: string | null;
};

type Params = {
	stopSelected: boolean;
	selectedVehicleRefs: Set<string>;
	intervalMs?: number;
};

export function useVehiclePolling({
	stopSelected,
	selectedVehicleRefs,
	intervalMs = ANIMATION_DURATION,
}: Params) {
	const [vehicles, setVehicles] = useState<Vehicle[]>([]);
	const selectedVehicleRefsRef = useRef<Set<string>>(new Set());
	const vehiclesAbortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		selectedVehicleRefsRef.current = selectedVehicleRefs;
	}, [selectedVehicleRefs]);

	useEffect(() => {
		// only poll vehicle positions when we actually need to render them
		const shouldPoll = stopSelected && selectedVehicleRefs.size > 0;

		if (!shouldPoll) {
			if (vehiclesAbortRef.current) {
				vehiclesAbortRef.current.abort();
				vehiclesAbortRef.current = null;
			}
			setVehicles([]);
			return;
		}

		let isUnmounted = false;

		const fetchVehicles = async () => {
			if (typeof document !== "undefined" && document.hidden) {
				return;
			}

			const wantedRefs = Array.from(selectedVehicleRefsRef.current);
			if (!wantedRefs.length) return;

			if (vehiclesAbortRef.current) {
				vehiclesAbortRef.current.abort();
			}
			const controller = new AbortController();
			vehiclesAbortRef.current = controller;

			try {
				const res = await fetch(VEHICLES_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ids: wantedRefs }),
					signal: controller.signal,
				});
				if (!res.ok) {
					throw new Error(`vehicle proxy responded with ${res.status}`);
				}
				const data = (await res.json()) as VehicleProxyResponse;
				const relevantVehicles = Array.isArray(data.vehicles)
					? data.vehicles
					: [];

				if (!isUnmounted) {
					setVehicles(relevantVehicles);
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") return;
				console.error("Failed to fetch vehicles via proxy:", err);
			}
		};

		fetchVehicles();
		const interval = setInterval(fetchVehicles, intervalMs);

		return () => {
			isUnmounted = true;
			clearInterval(interval);
			if (vehiclesAbortRef.current) {
				vehiclesAbortRef.current.abort();
				vehiclesAbortRef.current = null;
			}
		};
	}, [intervalMs, selectedVehicleRefs.size, stopSelected]);

	return vehicles;
}
