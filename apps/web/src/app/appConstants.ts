export const STOP_FLY_TO_ZOOM = 16;
export const STOP_FLY_TO_DURATION_MS = 800;

export const USER_LOCATION_FLY_TO_ZOOM = 16;
export const USER_LOCATION_FLY_TO_DURATION_MS = 800;

export const HOME_FLY_TO_DURATION_MS = 800;

export const GEOLOCATION_TIMEOUT_MS = 12_000;
export const GEOLOCATION_MAX_AGE_MS = 30_000;

export const MAP_INITIAL_VIEW_STATE = {
	longitude: 22.27,
	latitude: 60.45,
	zoom: 13,
} as const;

export const MAP_MIN_ZOOM = 10;

export const INTERACTIVE_LAYER_IDS = [
	"stops-circle",
	"stops-label",
	"favorite-stops-circle",
	"favorite-stops-label",
] as const;

export const TRACKING_CENTER_THROTTLE_MS = 200;
