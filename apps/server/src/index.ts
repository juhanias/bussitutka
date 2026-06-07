import { Elysia } from "elysia";
import { resolve, extname } from "node:path";
import { existsSync } from "node:fs";

import { loadGtfsDataset } from "./gtfs/loader";
import { buildStopSchedule, buildStopScheduleRange } from "./gtfs/schedule";
import type { GtfsData } from "./gtfs/types";

const SIRI_VM_URL = process.env.SIRI_VM_URL ?? "https://data.foli.fi/siri/vm";
const SIRI_SM_BASE_URL =
	process.env.SIRI_SM_BASE_URL ?? "https://data.foli.fi/siri/sm";
const ALERTS_MESSAGES_URL =
	process.env.ALERTS_MESSAGES_URL ?? "https://data.foli.fi/alerts/messages";
const POLL_INTERVAL_MS = Number(process.env.SIRI_POLL_INTERVAL_MS ?? 4000);
const STALE_AFTER_MS = Number(process.env.SIRI_STALE_AFTER_MS ?? 20000);
const ALERTS_REFRESH_INTERVAL_MS = Number(
	process.env.ALERTS_REFRESH_INTERVAL_MS ?? 60_000,
);
const MAX_IDS_PER_REQUEST = Number(process.env.SIRI_MAX_IDS_PER_REQUEST ?? 200);
const MAX_GTFS_TRIPS_PER_REQUEST = Number(
	process.env.GTFS_TRIPS_MAX_IDS ?? 60,
);
const GTFS_REFRESH_INTERVAL_MS = Number(
	process.env.GTFS_REFRESH_INTERVAL_MS ?? 6 * 60 * 60 * 1000,
);

type SiriVehicle = {
	vehicleref?: string;
	lineref?: string;
	destinationname?: string;
	next_stoppointname?: string;
	delaysecs?: number;
	latitude?: number;
	longitude?: number;
};

type SiriVmResponse = {
	result?: {
		vehicles?: Record<string, SiriVehicle>;
		responsetimestamp?: number;
	};
};

type SiriStopDeparture = {
	lineref?: string;
	destinationdisplay?: string;
	aimedarrivaltime?: number;
	expectedarrivaltime?: number;
	aimeddeparturetime?: number;
	expecteddeparturetime?: number;
	vehicleatstop?: boolean;
	monitored?: boolean;
	vehicleref?: string;
	__tripref?: string;
};

type SiriStopResponse = {
	result?: SiriStopDeparture[];
};

type AlertImage = {
	url?: string;
	type?: string;
	title?: string;
};

type AlertTranslation = {
	header?: string;
	message?: string;
	information?: string;
};

type StopAlert = {
	icon?: string;
	cause?: string;
	effect?: string;
	header?: string;
	images?: AlertImage[];
	repeat?: number[][];
	message?: string;
	isactive?: boolean;
	priority?: number;
	categories?: string[];
	message_id?: number;
	channel_web?: boolean;
	information?: string;
	translations?: Record<string, AlertTranslation>;
	channel_stops?: boolean;
	affected_stops?: string[];
	channel_gtfsrt?: boolean;
	channel_mobile?: boolean;
	channel_ticker?: boolean;
	affected_routes?: string[];
};

type AlertsMessagesResponse = {
	servertime?: number;
	global_message?: Record<string, unknown>;
	emergency_message?: Record<string, unknown>;
	messages?: StopAlert[];
};

type CachedAlertsPayload = {
	servertime: number | null;
	messages: StopAlert[];
	lastUpdated: number | null;
	error: string | null;
};

type StopDetailsResponse = {
	status: "ok";
	stopCode: string;
	departures: SiriStopDeparture[];
	alerts: StopAlert[];
	alertsLastUpdated: number | null;
	alertsError: string | null;
};

type VehicleSnapshot = {
	vehicleref: string;
	lineref: string;
	destinationname: string;
	next_stoppointname: string;
	delaysecs: number;
	latitude: number;
	longitude: number;
};

type IdInput = { ids?: string | string[] } | undefined;
type TripIdsInput = { tripIds?: string | string[] } | undefined;

type TripShape = {
	tripId: string;
	shapeId: string;
	coords: [number, number][];
};

const vehicleCache = new Map<string, VehicleSnapshot>();
let lastUpdated: number | null = null;
let lastSourceTimestamp: number | null = null;
let lastError: string | null = null;
let alertsCache: CachedAlertsPayload = {
	servertime: null,
	messages: [],
	lastUpdated: null,
	error: null,
};

let gtfsData: GtfsData | null = null;
let gtfsLoadedFrom: string | null = null;
let gtfsLastRefresh: number | null = null;
let gtfsLoadingPromise: Promise<void> | null = null;

const parseIdsFromString = (raw?: string): string[] =>
	raw
		?.split(",")
		.map((id) => id.trim())
		.filter(Boolean) ?? [];

const normalizeIds = (input: IdInput): string[] => {
	const raw = input?.ids;

	if (!raw) return [];

	const ids = Array.isArray(raw)
		? raw.map((id) => id.trim()).filter(Boolean)
		: parseIdsFromString(raw);

	// dedupe to keep payloads smaller
	return Array.from(new Set(ids)).slice(0, MAX_IDS_PER_REQUEST);
};

const normalizeTripIds = (input: TripIdsInput): string[] => {
	const raw = input?.tripIds;

	if (!raw) return [];

	const ids = Array.isArray(raw)
		? raw.map((id) => id.trim()).filter(Boolean)
		: parseIdsFromString(raw);

	return Array.from(new Set(ids)).slice(0, MAX_GTFS_TRIPS_PER_REQUEST);
};

const normalizeVehicle = (raw: SiriVehicle): VehicleSnapshot | null => {
	if (!raw?.vehicleref) return null;
	if (typeof raw.latitude !== "number" || typeof raw.longitude !== "number") {
		return null;
	}

	return {
		vehicleref: raw.vehicleref,
		lineref: raw.lineref ?? "",
		destinationname: raw.destinationname ?? "",
		next_stoppointname: raw.next_stoppointname ?? "",
		delaysecs: typeof raw.delaysecs === "number" ? raw.delaysecs : 0,
		latitude: raw.latitude,
		longitude: raw.longitude,
	};
};

const refreshVehicleCache = async () => {
	try {
		const response = await fetch(SIRI_VM_URL);
		if (!response.ok) {
			throw new Error(`siri vm responded with ${response.status}`);
		}

		const payload = (await response.json()) as SiriVmResponse;
		const vehicles = payload.result?.vehicles ?? {};
		vehicleCache.clear();

		for (const raw of Object.values(vehicles)) {
			const vehicle = normalizeVehicle(raw as SiriVehicle);
			if (vehicle) {
				vehicleCache.set(vehicle.vehicleref, vehicle);
			}
		}

		lastUpdated = Date.now();
		lastSourceTimestamp = payload.result?.responsetimestamp ?? null;
		lastError = null;
	} catch (error) {
		lastError = error instanceof Error ? error.message : "unknown error";
	}
};

const normalizeAlert = (raw: StopAlert): StopAlert | null => {
	if (!raw.isactive) return null;

	const affectedStops = raw.affected_stops
		?.map((stopCode) => stopCode.trim())
		.filter(Boolean);

	if (!affectedStops?.length) return null;

	return {
		...raw,
		affected_stops: affectedStops,
	};
};

const refreshAlertsCache = async () => {
	try {
		const response = await fetch(ALERTS_MESSAGES_URL);
		if (!response.ok) {
			throw new Error(`alerts responded with ${response.status}`);
		}

		const payload = (await response.json()) as AlertsMessagesResponse;
		const messages = (payload.messages ?? [])
			.map(normalizeAlert)
			.filter((alert): alert is StopAlert => Boolean(alert));

		alertsCache = {
			servertime:
				typeof payload.servertime === "number" ? payload.servertime : null,
			messages,
			lastUpdated: Date.now(),
			error: null,
		};
	} catch (error) {
		alertsCache = {
			...alertsCache,
			error: error instanceof Error ? error.message : "unknown error",
		};
	}
};

const startPolling = () => {
	// keep polling server-side so the browser does not have to pull the full VM payload
	void refreshVehicleCache();
	setInterval(refreshVehicleCache, POLL_INTERVAL_MS);
	void refreshAlertsCache();
	setInterval(refreshAlertsCache, ALERTS_REFRESH_INTERVAL_MS);
};

const buildVehicleList = (ids: string[]): VehicleSnapshot[] => {
	const list: VehicleSnapshot[] = [];

	for (const id of ids) {
		const vehicle = vehicleCache.get(id);
		if (vehicle) {
			list.push(vehicle);
		}
	}

	return list;
};

const buildVehicleResponse = (
	ids: string[],
	set: { status: number; headers: Record<string, string> },
) => {
	if (!ids.length) {
		set.status = 400;
		return { status: "error", message: "ids required" };
	}

	set.headers["Cache-Control"] = "no-store";
	const vehicles = buildVehicleList(ids);
	return {
		status: "ok",
		vehicles,
		lastUpdated,
		sourceTimestamp: lastSourceTimestamp,
		cacheSize: vehicleCache.size,
		stale: lastUpdated ? Date.now() - lastUpdated > STALE_AFTER_MS : true,
		error: lastError,
	};
};

const buildTripShapesResponse = (
	tripIds: string[],
	set: { status: number; headers: Record<string, string> },
) => {
	if (!tripIds.length) {
		set.status = 400;
		return { status: "error", message: "tripIds required" };
	}

	if (!gtfsData) {
		set.status = 503;
		return { status: "error", message: "gtfs dataset not ready" };
	}

	const shapes: TripShape[] = [];

	for (const tripId of tripIds) {
		const trip = gtfsData.trips.get(tripId);
		const shapeId = trip?.shape_id;
		if (!shapeId) continue;
		const points = gtfsData.shapes.get(shapeId);
		if (!points?.length) continue;
		const coords: [number, number][] = points.map((point) => [
			point.shape_pt_lon,
			point.shape_pt_lat,
		]);
		shapes.push({ tripId, shapeId, coords });
	}

	set.headers["Cache-Control"] = "no-store";
	return {
		status: "ok",
		shapes,
		datasetId: gtfsData.datasetId,
		generatedAt: Date.now(),
	};
};

const buildAlertsResponse = (
	set: { headers: Record<string, string> },
): CachedAlertsPayload & { status: "ok" } => {
	set.headers["Cache-Control"] = "no-store";
	return {
		status: "ok",
		...alertsCache,
	};
};

const fetchStopDetails = async (
	stopCode: string,
): Promise<StopDetailsResponse> => {
	const response = await fetch(
		`${SIRI_SM_BASE_URL}/${encodeURIComponent(stopCode)}`,
	);
	if (!response.ok) {
		throw new Error(`siri sm responded with ${response.status}`);
	}

	const payload = (await response.json()) as SiriStopResponse;
	const departures = (payload.result ?? []).slice(0, 10);
	const alerts = alertsCache.messages.filter((alert) =>
		alert.affected_stops?.includes(stopCode),
	);

	return {
		status: "ok",
		stopCode,
		departures,
		alerts,
		alertsLastUpdated: alertsCache.lastUpdated,
		alertsError: alertsCache.error,
	};
};

const refreshGtfs = async () => {
	if (gtfsLoadingPromise) return gtfsLoadingPromise;
	gtfsLoadingPromise = (async () => {
		try {
			const { data, loadedFrom } = await loadGtfsDataset();
			gtfsData = data;
			gtfsLoadedFrom = loadedFrom;
			gtfsLastRefresh = Date.now();
			console.log(`GTFS dataset loaded (${data.datasetId}) from ${loadedFrom}`);
		} catch (error) {
			console.error("Failed to load GTFS dataset", error);
		} finally {
			gtfsLoadingPromise = null;
		}
	})();
	return gtfsLoadingPromise;
};

startPolling();
void refreshGtfs();
setInterval(() => {
	void refreshGtfs();
}, GTFS_REFRESH_INTERVAL_MS);

const publicDir = resolve(import.meta.dir, '../public');

const getMimeType = (filepath: string): string => {
	const ext = extname(filepath).toLowerCase();
	const mimeTypes: Record<string, string> = {
		'.html': 'text/html',
		'.js': 'application/javascript',
		'.css': 'text/css',
		'.json': 'application/json',
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.webmanifest': 'application/manifest+json',
		'.ico': 'image/x-icon',
	};
	return mimeTypes[ext] || 'application/octet-stream';
};

const app = new Elysia()
	.get("/test-file", () => Bun.file("public/vite.svg"))
	.get("/api/health", () => ({
		status: "ok",
		vehiclesCached: vehicleCache.size,
		lastUpdated,
		sourceTimestamp: lastSourceTimestamp,
		pollIntervalMs: POLL_INTERVAL_MS,
		stale: lastUpdated ? Date.now() - lastUpdated > STALE_AFTER_MS : true,
		error: lastError,
		datasetId: gtfsData?.datasetId ?? null,
		gtfsLastRefresh,
		gtfsLoadedFrom,
	}))
	.get("/api/vehicles", ({ query, set }) => {
		const ids = normalizeIds(query as IdInput);
		return buildVehicleResponse(ids, set);
	})
	.post("/api/vehicles", ({ body, set }) => {
		// allow POST bodies to avoid very long query strings when tracking many vehicles
		const ids = normalizeIds(body as IdInput);
		return buildVehicleResponse(ids, set);
	})
	.get("/api/gtfs/status", () => ({
		status: gtfsData ? "ok" : "loading",
		datasetId: gtfsData?.datasetId ?? null,
		gtfsLastRefresh,
		gtfsLoadedFrom,
	}))
	.get("/api/alerts/stops", ({ set }) => buildAlertsResponse(set))
	.get("/api/stops/:stopCode", async ({ params, set }) => {
		const stopCode = params.stopCode?.trim();

		if (!stopCode) {
			set.status = 400;
			return { status: "error", message: "stopCode required" };
		}

		try {
			set.headers["Cache-Control"] = "no-store";
			return await fetchStopDetails(stopCode);
		} catch (error) {
			set.status = 502;
			return {
				status: "error",
				message:
					error instanceof Error ? error.message : "failed to fetch stop details",
			};
		}
	})
	.post("/api/gtfs/shapes", ({ body, set }) => {
		const tripIds = normalizeTripIds(body as TripIdsInput);
		return buildTripShapesResponse(tripIds, set);
	})
	.post("/api/schedule/stop", ({ body, set }) => {
		const { stopCode, limit, now, days, maxPerDay } = body as {
			stopCode?: string;
			limit?: number;
			now?: number;
			days?: number;
			maxPerDay?: number;
		};

		if (!stopCode) {
			set.status = 400;
			return { status: "error", message: "stopCode required" };
		}

		if (!gtfsData) {
			set.status = 503;
			return { status: "error", message: "gtfs dataset not ready" };
		}

		const nowDate = now ? new Date(now) : new Date();
		set.headers["Cache-Control"] = "no-store";
		if (days && days > 1) {
			return buildStopScheduleRange(
				gtfsData,
				stopCode,
				nowDate,
				days,
				maxPerDay,
			);
		}
		return buildStopSchedule(gtfsData, stopCode, nowDate, limit);
	})
	.get('*', ({ path, set }) => {
		// serve static files from public directory
		let filepath = path === '/' ? '/index.html' : path;
		const fullPath = resolve(publicDir, filepath.slice(1));
		
		// security check: ensure the resolved path is within publicDir
		if (!fullPath.startsWith(publicDir)) {
			set.status = 403;
			return 'Forbidden';
		}
		
		if (!existsSync(fullPath)) {
			set.status = 404;
			return 'Not Found';
		}
		
		set.headers['Content-Type'] = getMimeType(fullPath);
		return Bun.file(fullPath);
	})
	.listen(3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
