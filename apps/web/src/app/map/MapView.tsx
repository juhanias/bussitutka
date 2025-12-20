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
	busesOutlineLayer,
	busesLayer,
	favoriteStopsCircleLayer,
	favoriteStopsLabelLayer,
	favoriteStopsShadowLayer,
	routeArrowsLayer,
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
}: Props) {
	return (
		<MapGL
			initialViewState={MAP_INITIAL_VIEW_STATE}
			minZoom={MAP_MIN_ZOOM}
			style={{ width: "100%", height: "100%" }}
			mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
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
						className="h-4 w-4 rounded-full bg-amber-300 ring-2 ring-black/40"
						aria-label="oma sijainti"
					/>
				</Marker>
			)}
			<AttributionControl customAttribution="bussit.juh.fi by Juhani Astikainen | Data from https://data.foli.fi" />
			<Source id="routes" type="geojson" data={routesGeojson}>
				<Layer {...routesOutlineLayer} />
				<Layer {...routesLayer} />
				<Layer {...routeArrowsLayer} />
			</Source>
			<Source id="bus-stops" type="geojson" data={stopsGeojson}>
				<Layer {...stopsShadowLayer} />
				<Layer {...stopsCircleLayer} />
				<Layer {...stopsLabelLayer} />
			</Source>
			<Source id="favorite-stops" type="geojson" data={favoriteStopsGeojson}>
				<Layer {...favoriteStopsShadowLayer} />
				<Layer {...favoriteStopsCircleLayer} />
				<Layer {...favoriteStopsLabelLayer} />
			</Source>
			<Source id="buses" type="geojson" data={busesGeojson}>
				<Layer {...busesOutlineLayer} />
				<Layer {...busesLayer} />
			</Source>
		</MapGL>
	);
}
