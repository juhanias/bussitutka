import type { FeatureCollection, LineString, Point } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";
import MapGL, {
	AttributionControl,
	Layer,
	type MapMouseEvent,
	Marker,
	Source,
	type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import {
	INTERACTIVE_LAYER_IDS,
	MAP_INITIAL_VIEW_STATE,
	MAP_MIN_ZOOM,
} from "@/app/appConstants";
import { registerMapImages } from "@/app/map/registerMapImages";
import {
	busesLayer,
	busesOutlineLayer,
	favoriteStopsCircleLayer,
	favoriteStopsLabelLayer,
	favoriteStopsShadowLayer,
	routesLayer,
	routesOutlineLayer,
	stopsCircleLayer,
	stopsLabelLayer,
	stopsShadowLayer,
} from "@/constants/layers";

type UserLocation = {
	lat: number;
	lon: number;
};

type Props = {
	routesGeojson: FeatureCollection<LineString>;
	stopsGeojson: FeatureCollection<Point>;
	favoriteStopsGeojson: FeatureCollection<Point>;
	busesGeojson: FeatureCollection<Point>;
	userLocation: UserLocation | null;
	onMapReady: (map: MaplibreMap) => void;
	onMapClick: (event: MapMouseEvent) => void;
	onMoveStart: (event: ViewStateChangeEvent) => void;
	mapTheme: "light" | "dark";
};

export function MapView({
	routesGeojson,
	stopsGeojson,
	favoriteStopsGeojson,
	busesGeojson,
	userLocation,
	onMapReady,
	onMapClick,
	onMoveStart,
	mapTheme,
}: Props) {
	const mapStyle =
		mapTheme === "dark"
			? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
			: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

	return (
		<MapGL
			initialViewState={MAP_INITIAL_VIEW_STATE}
			minZoom={MAP_MIN_ZOOM}
			style={{ width: "100%", height: "100%" }}
			mapStyle={mapStyle}
			onClick={onMapClick}
			onLoad={(event) => {
				registerMapImages(event.target);
				onMapReady(event.target);
			}}
			onMoveStart={onMoveStart}
			interactiveLayerIds={[...INTERACTIVE_LAYER_IDS]}
			cursor="pointer"
			attributionControl={false}
		>
			{userLocation && (
				<Marker
					longitude={userLocation.lon}
					latitude={userLocation.lat}
					anchor="center"
				>
					<div
						role="img"
						className="h-4 w-4 rounded-full bg-primary ring-2 ring-background"
						aria-label="oma sijainti"
					/>
				</Marker>
			)}
			<AttributionControl
				style={{ color: "black" }}
				customAttribution={
					"bussit.juh.fi by Juhani Astikainen | Data from <a href='https://data.foli.fi' target='_blank' rel='noreferrer'>data.foli.fi</a></span>"
				}
			/>
			<Source id="routes" type="geojson" data={routesGeojson}>
				<Layer {...routesOutlineLayer} />
				<Layer {...routesLayer} />
			</Source>
			<Source id="bus-stops" type="geojson" data={stopsGeojson}>
				<Layer {...stopsShadowLayer} />
				<Layer {...stopsCircleLayer(mapTheme)} />
				<Layer {...stopsLabelLayer(mapTheme)} />
			</Source>
			<Source id="favorite-stops" type="geojson" data={favoriteStopsGeojson}>
				<Layer {...favoriteStopsShadowLayer} />
				<Layer {...favoriteStopsCircleLayer(mapTheme)} />
				<Layer {...favoriteStopsLabelLayer(mapTheme)} />
			</Source>
			<Source id="buses" type="geojson" data={busesGeojson}>
				<Layer {...busesOutlineLayer} />
				<Layer {...busesLayer} />
			</Source>
		</MapGL>
	);
}
