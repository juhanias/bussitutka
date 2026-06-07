import type { Map as MaplibreMap } from "maplibre-gl";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect } from "react";
import type { MapMouseEvent } from "react-map-gl/maplibre";

import { STOP_FLY_TO_DURATION_MS, STOP_FLY_TO_ZOOM } from "@/app/appConstants";
import { STOP_DETAILS_ENDPOINT } from "@/constants/endpoints";
import type { BusStop, Departure, StopAlert, StopInfo } from "@/types/transport";

type Params = {
	stops: BusStop[];
	stopInfo: StopInfo;
	setStopInfo: (next: StopInfo | ((prev: StopInfo) => StopInfo)) => void;
	mapRef: MaplibreMap | null;
	loadRoutes: (departures: Departure[]) => void;
	dismissTrackingToast: () => void;
	setTrackedVehicleRef: (ref: string | null) => void;
	setIsSidebarVisible: (visible: boolean) => void;
	closeSearch: () => void;
};

type StopDetailsResponse = {
	departures?: Departure[];
	alerts?: StopAlert[];
};

export function useStopController({
	stops,
	stopInfo,
	setStopInfo,
	mapRef,
	loadRoutes,
	dismissTrackingToast,
	setTrackedVehicleRef,
	setIsSidebarVisible,
	closeSearch,
}: Params) {
	const [selectedStopCode, setSelectedStopCode] = useQueryState(
		"s",
		parseAsString.withOptions({ history: "push" }),
	);

	const flyToStop = useCallback(
		(stop: BusStop) => {
			if (!mapRef) return;
			if (!Number.isFinite(stop.stop_lat) || !Number.isFinite(stop.stop_lon)) {
				return;
			}

			mapRef.flyTo({
				center: [stop.stop_lon, stop.stop_lat],
				zoom: STOP_FLY_TO_ZOOM,
				duration: STOP_FLY_TO_DURATION_MS,
			});
		},
		[mapRef],
	);

	const fetchStopDetails = useCallback(
		(stop: BusStop) => {
			setIsSidebarVisible(true);
			dismissTrackingToast();
			setStopInfo({
				stop,
				departures: [],
				alerts: [],
				loading: true,
			});

			fetch(`${STOP_DETAILS_ENDPOINT}/${encodeURIComponent(stop.stop_code)}`)
				.then((res) => res.json())
				.then((data) => {
					const { departures = [], alerts = [] } = data as StopDetailsResponse;
					setStopInfo((prev) => ({
						...prev,
						departures,
						alerts,
						loading: false,
					}));
					loadRoutes(departures);
				})
				.catch((err) => {
					console.error("Failed to fetch stop info:", err);
					setStopInfo((prev) => ({
						...prev,
						loading: false,
					}));
				});
		},
		[dismissTrackingToast, loadRoutes, setIsSidebarVisible, setStopInfo],
	);

	const selectStop = useCallback(
		(stop: BusStop) => {
			closeSearch();
			setSelectedStopCode(stop.stop_code);
			fetchStopDetails(stop);
			flyToStop(stop);
		},
		[closeSearch, fetchStopDetails, flyToStop, setSelectedStopCode],
	);

	const handleMapClick = useCallback(
		(event: MapMouseEvent) => {
			const features = event.features;
			if (!features || !features.length) return;

			const feature = features[0];
			const stopCode = feature.properties?.stop_code;
			if (!stopCode) return;

			const stopName = feature.properties?.stop_name;
			const stop = stops.find((s) => s.stop_code === stopCode) || {
				stop_code: stopCode,
				stop_name: stopName,
				stop_lat: 0,
				stop_lon: 0,
			};

			setSelectedStopCode(stopCode);
			fetchStopDetails(stop);
			flyToStop(stop);
		},
		[fetchStopDetails, flyToStop, setSelectedStopCode, stops],
	);

	const handleClose = useCallback(() => {
		setStopInfo({ stop: null, departures: [], alerts: [], loading: false });
		loadRoutes([]);
		setTrackedVehicleRef(null);
		setSelectedStopCode(null);
		setIsSidebarVisible(true);
		dismissTrackingToast();
	}, [
		dismissTrackingToast,
		loadRoutes,
		setIsSidebarVisible,
		setSelectedStopCode,
		setStopInfo,
		setTrackedVehicleRef,
	]);

	useEffect(() => {
		if (!selectedStopCode) return;
		if (!stops.length) return;
		if (stopInfo.stop?.stop_code === selectedStopCode) return;

		const matchingStop = stops.find(
			(stop) => stop.stop_code === selectedStopCode,
		);
		if (!matchingStop) return;

		closeSearch();
		fetchStopDetails(matchingStop);
		flyToStop(matchingStop);
	}, [
		closeSearch,
		fetchStopDetails,
		flyToStop,
		selectedStopCode,
		stopInfo.stop,
		stops,
	]);

	useEffect(() => {
		if (selectedStopCode) return;
		if (!stopInfo.stop) return;

		loadRoutes([]);
		setStopInfo({ stop: null, departures: [], alerts: [], loading: false });
		setTrackedVehicleRef(null);
		setIsSidebarVisible(false);
		dismissTrackingToast();
	}, [
		dismissTrackingToast,
		loadRoutes,
		selectedStopCode,
		setIsSidebarVisible,
		setStopInfo,
		setTrackedVehicleRef,
		stopInfo.stop,
	]);

	return {
		selectedStopCode,
		setSelectedStopCode,
		selectStop,
		handleMapClick,
		handleClose,
		fetchStopDetails,
		flyToStop,
	};
}
