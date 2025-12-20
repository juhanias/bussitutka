import { useEffect, useRef, useState } from "react";

import { ANIMATION_DURATION, MIN_DISTANCE_FOR_BEARING } from "../constants/map";
import type { Vehicle, VehiclePosition } from "../types/transport";
import { calculateBearing, getDistance } from "../utils/geo";

export function useAnimatedVehicles(
	vehicles: Vehicle[],
	selectedVehicleRefs: Set<string>,
	stopSelected: boolean,
) {
	const [animatedPositions, setAnimatedPositions] = useState<
		Map<string, VehiclePosition>
	>(new Map());
	const animationRef = useRef<number | undefined>(undefined);
	const lastFetchTimeRef = useRef<number>(Date.now());
	const lastFrameTimeRef = useRef<number>(0);
	const prefersReducedMotionRef = useRef<boolean>(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => {
			prefersReducedMotionRef.current = mq.matches;
		};
		update();
		mq.addEventListener?.("change", update);
		return () => mq.removeEventListener?.("change", update);
	}, []);

	useEffect(() => {
		if (!stopSelected) {
			// avoid triggering rerenders if already empty
			setAnimatedPositions((prev) => (prev.size ? new Map() : prev));
			return;
		}

		const filteredVehicles = vehicles.filter((v) =>
			selectedVehicleRefs.has(v.vehicleref),
		);
		const now = Date.now();

		setAnimatedPositions((prev) => {
			const next = new Map<string, VehiclePosition>();
			let changed = false;

			for (const vehicle of filteredVehicles) {
				const existing = prev.get(vehicle.vehicleref);

				if (existing) {
					// if the endpoint didn't change, keep the existing segment to avoid unnecessary churn
					if (
						existing.toLat === vehicle.latitude &&
						existing.toLon === vehicle.longitude
					) {
						next.set(vehicle.vehicleref, existing);
						continue;
					}

					const distance = getDistance(
						existing.currentLat,
						existing.currentLon,
						vehicle.latitude,
						vehicle.longitude,
					);
					const hasMovement = distance > MIN_DISTANCE_FOR_BEARING;
					const newBearing = hasMovement
						? calculateBearing(
								existing.currentLat,
								existing.currentLon,
								vehicle.latitude,
								vehicle.longitude,
							)
						: existing.bearing;

					next.set(vehicle.vehicleref, {
						...vehicle,
						fromLat: existing.currentLat,
						fromLon: existing.currentLon,
						toLat: vehicle.latitude,
						toLon: vehicle.longitude,
						currentLat: existing.currentLat,
						currentLon: existing.currentLon,
						bearing: newBearing,
						hasDirection: newBearing !== null,
					});
					changed = true;
				} else {
					next.set(vehicle.vehicleref, {
						...vehicle,
						fromLat: vehicle.latitude,
						fromLon: vehicle.longitude,
						toLat: vehicle.latitude,
						toLon: vehicle.longitude,
						currentLat: vehicle.latitude,
						currentLon: vehicle.longitude,
						bearing: null,
						hasDirection: false,
					});
					changed = true;
				}
			}

			// if vehicles disappeared, that's a change too
			if (next.size !== prev.size) {
				changed = true;
			}

			if (changed) {
				lastFetchTimeRef.current = now;
				return next;
			}

			return prev;
		});
	}, [vehicles, selectedVehicleRefs, stopSelected]);

	useEffect(() => {
		if (!stopSelected) return;

		const animate = () => {
			const targetFps = prefersReducedMotionRef.current ? 10 : 30;
			const minFrameMs = 1000 / targetFps;
			const frameNow = performance.now();

			if (frameNow - lastFrameTimeRef.current < minFrameMs) {
				animationRef.current = requestAnimationFrame(animate);
				return;
			}

			lastFrameTimeRef.current = frameNow;

			const elapsed = Date.now() - lastFetchTimeRef.current;
			const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
			const eased = 1 - (1 - progress) ** 3;

			setAnimatedPositions((prev) => {
				const next = new Map<string, VehiclePosition>();

				for (const [id, pos] of prev) {
					next.set(id, {
						...pos,
						currentLat: pos.fromLat + (pos.toLat - pos.fromLat) * eased,
						currentLon: pos.fromLon + (pos.toLon - pos.fromLon) * eased,
					});
				}

				return next;
			});

			animationRef.current = requestAnimationFrame(animate);
		};

		animationRef.current = requestAnimationFrame(animate);

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [stopSelected]);

	return animatedPositions;
}
