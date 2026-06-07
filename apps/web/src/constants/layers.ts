import type { ExpressionSpecification } from "maplibre-gl";
import type { LayerProps } from "react-map-gl/maplibre";

const STOP_FADE_START_ZOOM = 12.5;
const STOP_FADE_END_ZOOM = 13;
const STOPS_LABEL_MINZOOM = 15;
const STOPS_MINZOOM = 12.5;
const FAVORITE_MINZOOM = 9;
const FAVORITE_LABEL_MINZOOM = 10;

const STOP_SHADOW_RADIUS_ZOOM = { z1: 13, r1: 6, z2: 16, r2: 12 };
const STOP_CIRCLE_RADIUS_ZOOM = { z1: 13, r1: 4, z2: 16, r2: 8 };

const FAVORITE_SHADOW_RADIUS_STOPS = [10, 6, 13, 10, 16, 14] as const;
const FAVORITE_CIRCLE_RADIUS_STOPS = [10, 5, 13, 8, 16, 12] as const;

export const DEFAULT_LINE_COLOR = "#f97316";
export const DEFAULT_LINE_OUTLINE_COLOR = "#c2410c";

const STOP_PRIMARY_COLOR = "#f97316";
const STOP_FAVORITE_COLOR = "#fbbf24";
const STOP_SHADOW_COLOR = "rgba(0,0,0,0.3)";
const FAVORITE_SHADOW_COLOR = "rgba(0,0,0,0.4)";

// ensures stop fill and outline fade together at the same zoom threshold
const stopFadeInByZoom = [
	"interpolate",
	["linear"],
	["zoom"],
	STOP_FADE_START_ZOOM,
	0,
	STOP_FADE_END_ZOOM,
	1,
] as ExpressionSpecification;

export const stopsShadowLayer: LayerProps = {
	id: "stops-shadow",
	type: "circle",
	paint: {
		"circle-radius": [
			"interpolate",
			["linear"],
			["zoom"],
			STOP_SHADOW_RADIUS_ZOOM.z1,
			STOP_SHADOW_RADIUS_ZOOM.r1,
			STOP_SHADOW_RADIUS_ZOOM.z2,
			STOP_SHADOW_RADIUS_ZOOM.r2,
		],
		"circle-color": STOP_SHADOW_COLOR,
		"circle-blur": 0.5,
		"circle-translate": [2, 2],
		"circle-opacity": stopFadeInByZoom,
	},
	minzoom: STOPS_MINZOOM,
};

export const stopsCircleLayer = (theme: "light" | "dark"): LayerProps => ({
	id: "stops-circle",
	type: "circle",
	paint: {
		"circle-radius": [
			"interpolate",
			["linear"],
			["zoom"],
			STOP_CIRCLE_RADIUS_ZOOM.z1,
			STOP_CIRCLE_RADIUS_ZOOM.r1,
			STOP_CIRCLE_RADIUS_ZOOM.z2,
			STOP_CIRCLE_RADIUS_ZOOM.r2,
		],
		"circle-color": theme === "dark" ? "#ea580c" : STOP_PRIMARY_COLOR,
		"circle-stroke-color": theme === "dark" ? "#fff7ed" : "#ffffff",
		"circle-stroke-width": 2,
		"circle-opacity": stopFadeInByZoom,
		"circle-stroke-opacity": stopFadeInByZoom,
	},
	minzoom: STOPS_MINZOOM,
});

export const stopsLabelLayer = (theme: "light" | "dark"): LayerProps => ({
	id: "stops-label",
	type: "symbol",
	layout: {
		"text-field": [
			"step",
			["zoom"],
			["get", "stop_code"],
			16.5,
			["concat", ["get", "stop_code"], " ", ["get", "stop_name"]],
		],
		"text-size": ["interpolate", ["linear"], ["zoom"], 15, 11, 17, 13],
		"text-offset": [1, 0],
		"text-anchor": "left",
		"text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
		"text-max-width": 12,
	},
	paint: {
		"text-color": theme === "dark" ? "#ffffff" : "#333",
		"text-halo-color":
			theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
		"text-halo-width": 2,
	},
	minzoom: STOPS_LABEL_MINZOOM,
});

export const favoriteStopsShadowLayer: LayerProps = {
	id: "favorite-stops-shadow",
	type: "circle",
	paint: {
		"circle-radius": [
			"interpolate",
			["linear"],
			["zoom"],
			FAVORITE_SHADOW_RADIUS_STOPS[0],
			FAVORITE_SHADOW_RADIUS_STOPS[1],
			FAVORITE_SHADOW_RADIUS_STOPS[2],
			FAVORITE_SHADOW_RADIUS_STOPS[3],
			FAVORITE_SHADOW_RADIUS_STOPS[4],
			FAVORITE_SHADOW_RADIUS_STOPS[5],
		],
		"circle-color": FAVORITE_SHADOW_COLOR,
		"circle-blur": 0.5,
		"circle-translate": [2, 2],
	},
	minzoom: FAVORITE_MINZOOM,
};

export const favoriteStopsCircleLayer = (
	theme: "light" | "dark",
): LayerProps => ({
	id: "favorite-stops-circle",
	type: "circle",
	paint: {
		"circle-radius": [
			"interpolate",
			["linear"],
			["zoom"],
			FAVORITE_CIRCLE_RADIUS_STOPS[0],
			FAVORITE_CIRCLE_RADIUS_STOPS[1],
			FAVORITE_CIRCLE_RADIUS_STOPS[2],
			FAVORITE_CIRCLE_RADIUS_STOPS[3],
			FAVORITE_CIRCLE_RADIUS_STOPS[4],
			FAVORITE_CIRCLE_RADIUS_STOPS[5],
		],
		"circle-color": STOP_FAVORITE_COLOR,
		"circle-stroke-color": theme === "dark" ? "#ffffff" : "#ffffff",
		"circle-stroke-width": 2.5,
	},
	minzoom: FAVORITE_MINZOOM,
});

export const favoriteStopsLabelLayer = (
	theme: "light" | "dark",
): LayerProps => ({
	id: "favorite-stops-label",
	type: "symbol",
	layout: {
		"text-field": ["concat", ["get", "stop_code"], " ", ["get", "stop_name"]],
		"text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 13, 12, 16, 14],
		"text-offset": [1.2, 0],
		"text-anchor": "left",
		"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
		"text-max-width": 15,
	},
	paint: {
		"text-color": theme === "dark" ? "#ffffff" : "#92400e",
		"text-halo-color":
			theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)",
		"text-halo-width": 2,
	},
	minzoom: FAVORITE_LABEL_MINZOOM,
});

// trunk line colors for turku region
// screen color picked from some official pdf explainer Lol
export const TRUNK_LINE_COLORS: ReadonlyArray<[string, string]> = [
	["1", "#09baee"],
	["1A", "#09baee"],
	["2", "#ec6ea6"],
	["2Y", "#ec6ea6"],
	["3", "#77024d"],
	["3A", "#77024d"],
	["4", "#B2C54C"],
	["5", "#f59c00"],
	["5A", "#f59c00"],
	["6", "#009d3c"],
	["6A", "#009d3c"],
	["8", "#d20823"],
	["9", "#9574a5"],
	["9A", "#9574a5"],
	["10", "#005da0"],
	["10A", "#005da0"],
];

// build maplibre match expression for line colors
const lineColorExpression = [
	"match",
	["get", "lineref"],
	...TRUNK_LINE_COLORS.flat(),
	DEFAULT_LINE_COLOR,
] as unknown as ExpressionSpecification;

export function getLineColor(lineRef: string): string {
	const match = TRUNK_LINE_COLORS.find(([code]) => code === lineRef);
	return match ? match[1] : DEFAULT_LINE_COLOR;
}

export const busesLayer: LayerProps = {
	id: "buses",
	type: "symbol",
	layout: {
		"icon-image": [
			"case",
			["get", "hasDirection"],
			"bus-icon-arrow",
			"bus-icon",
		],
		"icon-size": 1,
		"icon-allow-overlap": true,
		"icon-rotate": ["case", ["get", "hasDirection"], ["get", "bearing"], 0],
		"icon-rotation-alignment": "map",
		"text-field": ["get", "lineref"],
		"text-size": 11,
		"text-offset": [0, 0],
		"text-anchor": "center",
		"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
		"text-allow-overlap": true,
	},
	paint: {
		"icon-color": lineColorExpression,
		"text-color": "#ffffff",
	},
};

export const busesOutlineLayer: LayerProps = {
	id: "buses-outline",
	type: "symbol",
	layout: {
		"icon-image": [
			"case",
			["get", "hasDirection"],
			"bus-icon-arrow-outline",
			"bus-icon-outline",
		],
		"icon-size": 1,
		"icon-allow-overlap": true,
		"icon-rotate": ["case", ["get", "hasDirection"], ["get", "bearing"], 0],
		"icon-rotation-alignment": "map",
		"text-field": "",
	},
	paint: {
		"icon-opacity": 1,
	},
};

export const routesLayer: LayerProps = {
	id: "routes",
	type: "line",
	layout: {
		"line-join": "round",
		"line-cap": "round",
	},
	paint: {
		"line-color": lineColorExpression,
		"line-width": 5,
		"line-opacity": 0.8,
	},
};

// darker outline colors for trunk lines
export const TRUNK_LINE_OUTLINE_COLORS: ReadonlyArray<[string, string]> = [
	["1", "#067a9e"],
	["1A", "#067a9e"],
	["2", "#b34d7a"],
	["2Y", "#b34d7a"],
	["3", "#4a0130"],
	["3A", "#4a0130"],
	["4", "#7a8a35"],
	["5", "#b37300"],
	["5A", "#b37300"],
	["6", "#006b29"],
	["6A", "#006b29"],
	["8", "#8f0618"],
	["9", "#5f4a6e"],
	["9A", "#5f4a6e"],
	["10", "#003d6b"],
	["10A", "#003d6b"],
];

const lineOutlineColorExpression = [
	"match",
	["get", "lineref"],
	...TRUNK_LINE_OUTLINE_COLORS.flat(),
	DEFAULT_LINE_OUTLINE_COLOR,
] as unknown as ExpressionSpecification;

export const routesOutlineLayer: LayerProps = {
	id: "routes-outline",
	type: "line",
	layout: {
		"line-join": "round",
		"line-cap": "round",
	},
	paint: {
		"line-color": lineOutlineColorExpression,
		"line-width": 8,
		"line-opacity": 0.4,
	},
};
