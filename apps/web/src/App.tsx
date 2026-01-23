import type { FeatureCollection, LineString, Point } from "geojson";
import {
	Download,
	Home,
	Loader2,
	LocateFixed,
	Moon,
	Search,
	Star,
	Sun,
} from "lucide-react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	GEOLOCATION_MAX_AGE_MS,
	GEOLOCATION_TIMEOUT_MS,
	HOME_FLY_TO_DURATION_MS,
	MAP_INITIAL_VIEW_STATE,
	MAP_MIN_ZOOM,
	USER_LOCATION_FLY_TO_DURATION_MS,
	USER_LOCATION_FLY_TO_ZOOM,
} from "@/app/appConstants";
import { useStopController } from "@/app/hooks/useStopController";
import { useStops } from "@/app/hooks/useStops";
import { useVehiclePolling } from "@/app/hooks/useVehiclePolling";
import { useVehicleTracking } from "@/app/hooks/useVehicleTracking";
import { MapView } from "@/app/map/MapView";
import FavoritesMenu from "./components/FavoritesMenu";
import {
	OfflineIndicator,
	useOnlineStatus,
} from "./components/OfflineIndicator";
import StopSearch from "./components/StopSearch";
import StopSidebar from "./components/StopSidebar";
import { Toaster } from "./components/ui/sonner";
import { useAnimatedVehicles } from "./hooks/useAnimatedVehicles";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePWAInstall } from "./hooks/usePWAInstall";
import { useRouteShapes } from "./hooks/useRouteShapes";
import { useCustomStopNamesStore } from "./store/customStopNames";
import { useFavoritesStore } from "./store/favorites";
import type { BusStop, StopInfo } from "./types/transport";

const ORBIT_PITCH_DEGREES = 45;
const ORBIT_ROTATION_DEG_PER_SEC = 8;
const ORBIT_ZOOM_OFFSET = 1;

function App() {
	const isDev = import.meta.env.DEV;
	const isOnline = useOnlineStatus();
	const { canInstall, install } = usePWAInstall();
	const { stops } = useStops();
	const { getDisplayName } = useCustomStopNamesStore();
	const [stopInfo, setStopInfo] = useState<StopInfo>({
		stop: null,
		departures: [],
		loading: false,
	});
	const [mapRef, setMapRef] = useState<MaplibreMap | null>(null);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isSidebarVisible, setIsSidebarVisible] = useState(true);
	const [isLocating, setIsLocating] = useState(false);
	const [isOrbitToolEnabled, setIsOrbitToolEnabled] = useState(false);
	const [isOrbiting, setIsOrbiting] = useState(false);
	const orbitFrameRef = useRef<number | null>(null);
	const orbitStartRef = useRef<number | null>(null);
	const orbitTargetRef = useRef<{ lng: number; lat: number } | null>(null);
	const orbitZoomRef = useRef<number>(MAP_INITIAL_VIEW_STATE.zoom);
	const [userLocation, setUserLocation] = useState<{
		lat: number;
		lon: number;
	} | null>(null);
	// light by default regardless of sys preference (unsure of this is ethical). light is muuuch more polished
	const [mapTheme, setMapTheme] = useState<"light" | "dark">("light");

	const floatingActionButtonClass =
		"pointer-events-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card/90 px-4 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-card hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

	const handleLocateMe = useCallback(() => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			toast.error("Sijainti ei ole saatavilla", {
				description: "Selaimesi ei tue sijaintipalvelua.",
			});
			return;
		}

		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const { latitude, longitude } = pos.coords;
				setUserLocation({ lat: latitude, lon: longitude });

				if (mapRef) {
					mapRef.flyTo({
						center: [longitude, latitude],
						zoom: USER_LOCATION_FLY_TO_ZOOM,
						duration: USER_LOCATION_FLY_TO_DURATION_MS,
					});
				}
				setIsLocating(false);
			},
			(err) => {
				const isDenied = err.code === err.PERMISSION_DENIED;
				toast.error("Sijaintia ei saatu", {
					description: isDenied
						? "Salli sijainti selaimen asetuksista ja yritä uudelleen."
						: "Yritä hetken päästä uudelleen.",
				});
				setIsLocating(false);
			},
			{
				enableHighAccuracy: true,
				timeout: GEOLOCATION_TIMEOUT_MS,
				maximumAge: GEOLOCATION_MAX_AGE_MS,
			},
		);
	}, [mapRef]);

	const stopOrbit = useCallback(() => {
		if (orbitFrameRef.current !== null) {
			cancelAnimationFrame(orbitFrameRef.current);
			orbitFrameRef.current = null;
		}
		orbitStartRef.current = null;
		orbitTargetRef.current = null;
		setIsOrbiting(false);
	}, []);

	const animateOrbit = useCallback(
		(timestamp: number) => {
			if (!mapRef || !orbitTargetRef.current || !orbitStartRef.current) {
				return;
			}
			const elapsedSeconds = (timestamp - orbitStartRef.current) / 1000;
			const bearing = (elapsedSeconds * ORBIT_ROTATION_DEG_PER_SEC) % 360;
			const { lng, lat } = orbitTargetRef.current;
			mapRef.jumpTo({
				center: [lng, lat],
				bearing,
				pitch: ORBIT_PITCH_DEGREES,
				zoom: orbitZoomRef.current,
			});
			orbitFrameRef.current = requestAnimationFrame(animateOrbit);
		},
		[mapRef],
	);

	const startOrbit = useCallback(
		(lng: number, lat: number) => {
			if (!mapRef) return;
			stopOrbit();
			orbitTargetRef.current = { lng, lat };
			orbitStartRef.current = performance.now();
			setIsOrbiting(true);
			const currentZoom = mapRef.getZoom();
			orbitZoomRef.current = Math.max(
				MAP_MIN_ZOOM,
				currentZoom - ORBIT_ZOOM_OFFSET,
			);
			orbitFrameRef.current = requestAnimationFrame(animateOrbit);
		},
		[animateOrbit, mapRef, stopOrbit],
	);

	useEffect(() => {
		if (!isDev || !isOrbitToolEnabled) {
			stopOrbit();
		}
	}, [isDev, isOrbitToolEnabled, stopOrbit]);

	useEffect(() => stopOrbit, [stopOrbit]);
	const selectedVehicleRefs = useMemo(() => {
		if (!stopInfo.stop) return new Set<string>();
		return new Set(
			stopInfo.departures.map((d) => d.vehicleref).filter(Boolean),
		);
	}, [stopInfo.stop, stopInfo.departures]);

	const { favoriteStops, toggleFavorite } = useFavoritesStore();
	const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

	const favoriteStopsList = useMemo(() => {
		return stops.filter((stop) => favoriteStops.has(stop.stop_code));
	}, [stops, favoriteStops]);

	const { routeShapes, loadRoutes } = useRouteShapes();
	const vehicles = useVehiclePolling({
		stopSelected: Boolean(stopInfo.stop),
		selectedVehicleRefs,
	});

	const animatedPositions = useAnimatedVehicles(
		vehicles,
		selectedVehicleRefs,
		!!stopInfo.stop,
	);

	const isMobileView = useMediaQuery("(max-width: 639px)");
	const [mobileLineFilterRef, setMobileLineFilterRef] = useState<string | null>(
		null,
	);
	const {
		trackedVehicleRef,
		setTrackedVehicleRef,
		dismissTrackingToast,
		handleBusClick,
		handleMapInteractionStart,
	} = useVehicleTracking({
		mapRef,
		stopInfo,
		animatedPositions,
		setIsSidebarVisible,
		onMobileTrackingEnd: () => setMobileLineFilterRef(null),
	});

	const { selectStop, handleMapClick, handleClose } = useStopController({
		stops,
		stopInfo,
		setStopInfo,
		mapRef,
		loadRoutes,
		dismissTrackingToast,
		setTrackedVehicleRef,
		setIsSidebarVisible,
		closeSearch: () => setIsSearchOpen(false),
	});

	const handleMapClickWithOrbit = useCallback(
		(event: Parameters<typeof handleMapClick>[0]) => {
			if (isDev && isOrbitToolEnabled) {
				startOrbit(event.lngLat.lng, event.lngLat.lat);
				return;
			}
			handleMapClick(event);
		},
		[handleMapClick, isDev, isOrbitToolEnabled, startOrbit],
	);

	const handleMoveStartWithOrbit = useCallback(
		(event: Parameters<typeof handleMapInteractionStart>[0]) => {
			const isUserMove = Boolean(event.originalEvent);
			if (isDev && isOrbitToolEnabled && isUserMove) {
				stopOrbit();
			}
			handleMapInteractionStart(event);
		},
		[handleMapInteractionStart, isDev, isOrbitToolEnabled, stopOrbit],
	);

	const handleHome = useCallback(() => {
		setIsSearchOpen(false);
		setIsFavoritesOpen(false);
		setMobileLineFilterRef(null);
		stopOrbit();
		handleClose();
		if (!mapRef) return;
		mapRef.flyTo({
			center: [
				MAP_INITIAL_VIEW_STATE.longitude,
				MAP_INITIAL_VIEW_STATE.latitude,
			],
			zoom: MAP_INITIAL_VIEW_STATE.zoom,
			bearing: 0,
			pitch: 0,
			duration: HOME_FLY_TO_DURATION_MS,
		});
	}, [handleClose, mapRef, stopOrbit]);

	const handleCloseWithMobileReset = useCallback(() => {
		setMobileLineFilterRef(null);
		handleClose();
	}, [handleClose]);

	const geojson = useMemo<FeatureCollection<Point>>(
		() => ({
			type: "FeatureCollection",
			features: stops
				.filter((stop) => !favoriteStops.has(stop.stop_code))
				.map((stop) => ({
					type: "Feature",
					properties: {
						stop_code: stop.stop_code,
						stop_name: getDisplayName(stop.stop_code, stop.stop_name),
					},
					geometry: {
						type: "Point",
						coordinates: [stop.stop_lon, stop.stop_lat],
					},
				})),
		}),
		[stops, favoriteStops, getDisplayName],
	);

	const favoriteStopsGeojson = useMemo<FeatureCollection<Point>>(
		() => ({
			type: "FeatureCollection",
			features: stops
				.filter((stop) => favoriteStops.has(stop.stop_code))
				.map((stop) => ({
					type: "Feature",
					properties: {
						stop_code: stop.stop_code,
						stop_name: getDisplayName(stop.stop_code, stop.stop_name),
					},
					geometry: {
						type: "Point",
						coordinates: [stop.stop_lon, stop.stop_lat],
					},
				})),
		}),
		[stops, favoriteStops, getDisplayName],
	);

	const busesGeojson = useMemo<FeatureCollection<Point>>(() => {
		const vehiclesToRender = Array.from(animatedPositions.values());
		const activeLineFilter = isMobileView ? mobileLineFilterRef : null;
		const filteredVehicles = activeLineFilter
			? vehiclesToRender.filter(
					(vehicle) => vehicle.lineref === activeLineFilter,
				)
			: vehiclesToRender;

		return {
			type: "FeatureCollection",
			features: filteredVehicles.map((vehicle) => ({
				type: "Feature",
				properties: {
					vehicleref: vehicle.vehicleref,
					lineref: vehicle.lineref,
					destinationname: vehicle.destinationname,
					next_stoppointname: vehicle.next_stoppointname,
					delaysecs: vehicle.delaysecs,
					bearing: vehicle.bearing ?? 0,
					hasDirection: vehicle.hasDirection,
				},
				geometry: {
					type: "Point",
					coordinates: [vehicle.currentLon, vehicle.currentLat],
				},
			})),
		};
	}, [animatedPositions, isMobileView, mobileLineFilterRef]);

	const handleBusClickWithMobileLineFilter = useCallback(
		(vehicleRef: string) => {
			if (isMobileView) {
				const vehicle = animatedPositions.get(vehicleRef);
				if (vehicle?.lineref) {
					setMobileLineFilterRef(vehicle.lineref);
				}
			}
			handleBusClick(vehicleRef);
		},
		[animatedPositions, handleBusClick, isMobileView],
	);

	const handleStopSelect = useCallback(
		(stop: BusStop) => {
			setMobileLineFilterRef(null);
			selectStop(stop);
		},
		[selectStop],
	);

	const routesGeojson = useMemo<FeatureCollection<LineString>>(
		() => ({
			type: "FeatureCollection",
			features: routeShapes.map((shape, i) => ({
				type: "Feature",
				properties: {
					id: i,
					lineref: shape.lineref,
				},
				geometry: {
					type: "LineString",
					coordinates: shape.coords,
				},
			})),
		}),
		[routeShapes],
	);

	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
				event.preventDefault();
				setIsSearchOpen(true);
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				setIsFavoritesOpen(true);
			}
		};

		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, []);

	if (!isOnline) {
		return <OfflineIndicator />;
	}

	return (
		<>
			<Toaster
				position="bottom-center"
				expand
				toastOptions={{
					classNames: {
						toast:
							"!bg-card !border-border !text-foreground shadow-xl backdrop-blur-md",
						actionButton:
							"!bg-transparent !text-primary text-xs font-semibold uppercase tracking-wide hover:!bg-primary/10",
						description: "!text-muted-foreground",
					},
				}}
			/>
			<div
				className="relative w-screen overflow-hidden"
				style={{
					height: "var(--viewport-height)",
					minHeight: "var(--viewport-height)",
				}}
			>
				<div className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-10 flex flex-row justify-end gap-2 sm:left-auto sm:right-4 sm:w-auto">
					<button
						type="button"
						onClick={() => setIsSearchOpen(true)}
						className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card sm:w-auto sm:px-4"
						aria-label="Hae pysäkkejä"
					>
						<Search className="h-5 w-5 sm:mr-2" />
						<span className="hidden text-sm font-medium sm:inline">
							Hae pysäkkejä
						</span>
						<span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
							ctrl + f
						</span>
					</button>

					<button
						type="button"
						onClick={() => setIsFavoritesOpen(true)}
						className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card sm:w-auto sm:px-4"
						aria-label="Suosikit"
					>
						<Star className="h-5 w-5 sm:mr-2" />
						<span className="hidden text-sm font-medium sm:inline">
							Suosikit
						</span>
						<span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
							ctrl + s
						</span>
					</button>

					{isDev && !isOrbiting && (
						<button
							type="button"
							onClick={() => setIsOrbitToolEnabled((prev) => !prev)}
							className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card sm:w-auto sm:px-4 ${
								isOrbitToolEnabled ? "border-primary/40 text-primary" : ""
							}`}
							aria-pressed={isOrbitToolEnabled}
							aria-label="Cinematic orbit"
						>
							<span className="text-sm font-medium">Orbit</span>
						</button>
					)}

					<button
						type="button"
						onClick={() => setMapTheme(mapTheme === "light" ? "dark" : "light")}
						className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card sm:w-auto sm:px-4"
						aria-label={
							mapTheme === "light"
								? "Vaihda tummaan teemaan"
								: "Vaihda vaaleaan teemaan"
						}
					>
						{mapTheme === "light" ? (
							<Moon className="h-5 w-5 sm:mr-2" />
						) : (
							<Sun className="h-5 w-5 sm:mr-2" />
						)}
						<span className="hidden text-sm font-medium sm:inline">
							Vaihda teemaa
						</span>
					</button>

					{canInstall && (
						<button
							type="button"
							onClick={install}
							className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:border-primary/30 hover:bg-card sm:w-auto sm:px-4"
							aria-label="install app"
						>
							<Download className="h-5 w-5 sm:mr-2" />
							<span className="hidden text-sm font-medium sm:inline">
								Asenna sovellus
							</span>
						</button>
					)}
				</div>

				<div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] right-4 z-10 flex flex-col items-end gap-2">
					<button
						type="button"
						onClick={handleHome}
						disabled={!mapRef}
						className={floatingActionButtonClass}
						aria-label="Alkuun"
					>
						<Home className="h-4 w-4" aria-hidden="true" />
						<span>Alkuun</span>
					</button>

					<button
						type="button"
						onClick={handleLocateMe}
						disabled={isLocating}
						className={floatingActionButtonClass}
						aria-label="Oma sijainti"
					>
						{isLocating ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<LocateFixed className="h-4 w-4" aria-hidden="true" />
						)}
						<span>Paikanna</span>
					</button>
				</div>

				<FavoritesMenu
					isOpen={isFavoritesOpen}
					favorites={favoriteStopsList}
					stops={stops}
					missingCount={favoriteStops.size - favoriteStopsList.length}
					onSelect={handleStopSelect}
					onRemove={toggleFavorite}
					onClose={() => setIsFavoritesOpen(false)}
				/>

				<StopSearch
					isOpen={isSearchOpen}
					stops={stops}
					onSelect={handleStopSelect}
					onClose={() => setIsSearchOpen(false)}
				/>

				<StopSidebar
					stopInfo={stopInfo}
					onClose={handleCloseWithMobileReset}
					onBusClick={handleBusClickWithMobileLineFilter}
					trackedVehicleRef={trackedVehicleRef}
					isVisible={isSidebarVisible}
				/>

				<MapView
					routesGeojson={routesGeojson}
					stopsGeojson={geojson}
					favoriteStopsGeojson={favoriteStopsGeojson}
					busesGeojson={busesGeojson}
					userLocation={userLocation}
					onMapReady={setMapRef}
					onMapClick={handleMapClickWithOrbit}
					onMoveStart={handleMoveStartWithOrbit}
					mapTheme={mapTheme}
				/>
			</div>
		</>
	);
}

export default App;
