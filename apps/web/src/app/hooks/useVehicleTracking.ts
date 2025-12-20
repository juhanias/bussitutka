import type { Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewStateChangeEvent } from "react-map-gl/maplibre";
import { toast } from "sonner";

import {
	STOP_FLY_TO_DURATION_MS,
	STOP_FLY_TO_ZOOM,
	TRACKING_CENTER_THROTTLE_MS,
} from "@/app/appConstants";
import type { StopInfo, VehiclePosition } from "@/types/transport";

type Params = {
	mapRef: MaplibreMap | null;
	stopInfo: StopInfo;
	animatedPositions: Map<string, VehiclePosition>;
	setIsSidebarVisible: (visible: boolean) => void;
	onMobileTrackingEnd?: () => void;
};

export function useVehicleTracking({
	mapRef,
	stopInfo,
	animatedPositions,
	setIsSidebarVisible,
	onMobileTrackingEnd,
}: Params) {
	const [trackedVehicleRef, setTrackedVehicleRef] = useState<string | null>(
		null,
	);
	const trackingToastIdRef = useRef<string | number | null>(null);
	const isProgrammaticMoveRef = useRef(false);
	const lastTrackedCenterUpdateRef = useRef<number>(0);

	const dismissTrackingToast = useCallback(() => {
		if (trackingToastIdRef.current) {
			toast.dismiss(trackingToastIdRef.current);
			trackingToastIdRef.current = null;
		}
	}, []);

	const showMobileTrackingToast = useCallback(
		(vehicleRef: string) => {
			const departure = stopInfo.departures.find(
				(dep) => dep.vehicleref === vehicleRef,
			);
			dismissTrackingToast();

			trackingToastIdRef.current = toast("Seurataan bussia", {
				description: departure
					? `${departure.lineref} → ${departure.destinationdisplay}`
					: "Napauta nappia palataksesi aiempaan näkymään",
				action: {
					label: "Takaisin",
					onClick: () => {
						setTrackedVehicleRef(null);
						setIsSidebarVisible(true);
						dismissTrackingToast();
						onMobileTrackingEnd?.();
						if (stopInfo.stop && mapRef) {
							mapRef.flyTo({
								center: [stopInfo.stop.stop_lon, stopInfo.stop.stop_lat],
								zoom: STOP_FLY_TO_ZOOM,
								duration: STOP_FLY_TO_DURATION_MS,
							});
						}
					},
				},
				duration: Infinity,
				onDismiss: () => {
					setTrackedVehicleRef(null);
					setIsSidebarVisible(true);
					onMobileTrackingEnd?.();
				},
			});
		},
		[
			dismissTrackingToast,
			mapRef,
			onMobileTrackingEnd,
			setIsSidebarVisible,
			stopInfo.departures,
			stopInfo.stop,
		],
	);

	const handleBusClick = useCallback(
		(vehicleRef: string) => {
			const vehiclePos = animatedPositions.get(vehicleRef);
			if (!vehiclePos || !mapRef) return;

			setTrackedVehicleRef(vehicleRef);

			// programmatic move events don't have originalEvent, but keep this for extra safety
			isProgrammaticMoveRef.current = true;
			mapRef.flyTo({
				center: [vehiclePos.currentLon, vehiclePos.currentLat],
				zoom: 16,
				duration: 1000,
			});
			setTimeout(() => {
				isProgrammaticMoveRef.current = false;
			}, 1100);

			const isMobileView =
				typeof window !== "undefined" &&
				window.matchMedia("(max-width: 639px)").matches;
			if (isMobileView && stopInfo.stop) {
				setIsSidebarVisible(false);
				showMobileTrackingToast(vehicleRef);
			} else {
				setIsSidebarVisible(true);
				dismissTrackingToast();
			}
		},
		[
			animatedPositions,
			dismissTrackingToast,
			mapRef,
			setIsSidebarVisible,
			showMobileTrackingToast,
			stopInfo.stop,
		],
	);

	useEffect(() => {
		if (!trackedVehicleRef || !mapRef) return;

		const vehiclePos = animatedPositions.get(trackedVehicleRef);
		if (vehiclePos) {
			const now = performance.now();
			if (
				now - lastTrackedCenterUpdateRef.current <
				TRACKING_CENTER_THROTTLE_MS
			) {
				return;
			}
			lastTrackedCenterUpdateRef.current = now;
			mapRef.easeTo({
				center: [vehiclePos.currentLon, vehiclePos.currentLat],
				duration: 250,
			});
		}
	}, [trackedVehicleRef, animatedPositions, mapRef]);

	const handleMapInteractionStart = useCallback(
		(e: ViewStateChangeEvent) => {
			if (!e.originalEvent) return;
			if (isProgrammaticMoveRef.current) return;
			if (trackedVehicleRef) {
				setTrackedVehicleRef(null);
			}
		},
		[trackedVehicleRef],
	);

	return {
		trackedVehicleRef,
		setTrackedVehicleRef,
		dismissTrackingToast,
		handleBusClick,
		handleMapInteractionStart,
	};
}
