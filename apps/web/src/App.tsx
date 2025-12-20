import type { FeatureCollection, LineString, Point } from "geojson";
import { Download, Home, Loader2, LocateFixed, Search, Star } from "lucide-react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	GEOLOCATION_MAX_AGE_MS,
	GEOLOCATION_TIMEOUT_MS,
	HOME_FLY_TO_DURATION_MS,
	MAP_INITIAL_VIEW_STATE,
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
import { useFavoritesStore } from "./store/favorites";
import type { BusStop, StopInfo } from "./types/transport";

function App() {
	const isOnline = useOnlineStatus();
	const { canInstall, install } = usePWAInstall();
	const { stops } = useStops();
	const [stopInfo, setStopInfo] = useState<StopInfo>({
		stop: null,
		departures: [],
		loading: false,
	});
	const [mapRef, setMapRef] = useState<MaplibreMap | null>(null);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isSidebarVisible, setIsSidebarVisible] = useState(true);
	const [isLocating, setIsLocating] = useState(false);
	const [userLocation, setUserLocation] = useState<{
		lat: number;
		lon: number;
	} | null>(null);

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

	const handleHome = useCallback(() => {
		setIsSearchOpen(false);
		setIsFavoritesOpen(false);
		setMobileLineFilterRef(null);
		handleClose();
		if (!mapRef) return;
		mapRef.flyTo({
			center: [MAP_INITIAL_VIEW_STATE.longitude, MAP_INITIAL_VIEW_STATE.latitude],
			zoom: MAP_INITIAL_VIEW_STATE.zoom,
			bearing: 0,
			pitch: 0,
			duration: HOME_FLY_TO_DURATION_MS,
		});
	}, [handleClose, mapRef]);

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
						stop_name: stop.stop_name,
					},
					geometry: {
						type: "Point",
						coordinates: [stop.stop_lon, stop.stop_lat],
					},
				})),
		}),
		[stops, favoriteStops],
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
						stop_name: stop.stop_name,
					},
					geometry: {
						type: "Point",
						coordinates: [stop.stop_lon, stop.stop_lat],
					},
				})),
		}),
		[stops, favoriteStops],
	);

	const busesGeojson = useMemo<FeatureCollection<Point>>(() => {
		const vehiclesToRender = Array.from(animatedPositions.values());
		const activeLineFilter = isMobileView ? mobileLineFilterRef : null;
		const filteredVehicles =
			activeLineFilter
				? vehiclesToRender.filter((vehicle) => vehicle.lineref === activeLineFilter)
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
							"!bg-black/90 !border-white/10 !text-white shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-md",
						actionButton:
							"!bg-transparent !text-amber-300 text-xs font-semibold uppercase tracking-wide hover:!bg-white/10",
						description: "!text-white/70",
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
						className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white transition-colors hover:border-white/40 hover:bg-black/85 sm:w-auto sm:px-4"
						aria-label="Hae pysäkkejä"
					>
						<Search className="h-5 w-5 sm:mr-2" />
						<span className="hidden text-sm font-medium sm:inline">
							Hae pysäkkejä
						</span>
						<span className="ml-2 hidden text-xs text-white/50 sm:inline">
							ctrl + f
						</span>
					</button>

					<button
						type="button"
						onClick={() => setIsFavoritesOpen(true)}
						className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white transition-colors hover:border-white/40 hover:bg-black/85 sm:w-auto sm:px-4"
						aria-label="Suosikit"
					>
						<Star className="h-5 w-5 sm:mr-2" />
						<span className="hidden text-sm font-medium sm:inline">
							Suosikit
						</span>
					</button>

					{canInstall && (
						<button
							type="button"
							onClick={install}
							className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/75 text-white transition-colors hover:border-white/40 hover:bg-black/85 sm:w-auto sm:px-4"
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
						className="pointer-events-auto inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/75 px-4 text-sm font-medium text-white transition-colors hover:border-white/40 hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
						aria-label="Alkuun"
					>
						<Home className="h-4 w-4" aria-hidden="true" />
						<span>Alkuun</span>
					</button>

					<button
						type="button"
						onClick={handleLocateMe}
						disabled={isLocating}
						className="pointer-events-auto inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/75 px-4 text-sm font-medium text-white transition-colors hover:border-white/40 hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
						aria-label="Oma sijainti"
					>
						{isLocating ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<LocateFixed className="h-4 w-4" aria-hidden="true" />
						)}
						<span>Oma sijainti</span>
					</button>
				</div>

				<FavoritesMenu
					isOpen={isFavoritesOpen}
					favorites={favoriteStopsList}
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
					onMapClick={handleMapClick}
					onMoveStart={handleMapInteractionStart}
				/>
			</div>
		</>
	);
}

export default App;
