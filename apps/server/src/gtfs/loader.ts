import AdmZip from "adm-zip";
import { mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";

import { parseCsv, parseCsvLine } from "./csv";
import type {
	CalendarDateRow,
	CalendarRow,
	GtfsData,
	RouteRow,
	ShapePoint,
	StopRow,
	StopTimeRow,
	TripRow,
} from "./types";

const REQUIRED_FILES = [
	"stops.txt",
	"routes.txt",
	"trips.txt",
	"shapes.txt",
	"stop_times.txt",
	"calendar.txt",
	"calendar_dates.txt",
];

const DEFAULT_STORAGE = join(import.meta.dir, "../data/gtfs");
const LOCAL_FALLBACK = join(import.meta.dir, "../agent-help/gtfs");

export type GtfsDataset = {
	data: GtfsData;
	loadedFrom: string;
};

const toInt = (value: string) => Number.parseInt(value, 10);

const gtfsTimeToMinutes = (time: string): number => {
	const [hours, minutes] = time.split(":").map((v) => Number.parseInt(v, 10));
	return hours * 60 + minutes;
};

async function fetchLatestDatasetId(): Promise<string | null> {
	try {
		const res = await fetch("https://data.foli.fi/gtfs/v0/");
		if (!res.ok) return null;
		const json = (await res.json()) as { latest?: string };
		return json.latest ?? null;
	} catch (_err) {
		return null;
	}
}

async function downloadAndExtract(datasetId: string, targetDir: string) {
	const url = `https://data.foli.fi/gtfs/v0/${datasetId}/gtfs.zip`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`failed to download gtfs zip ${res.status}`);
	const buffer = await res.arrayBuffer();
	const zip = new AdmZip(Buffer.from(buffer));
	mkdirSync(targetDir, { recursive: true });
	zip.extractAllTo(targetDir, true);
}

function ensureDir(dir: string) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

async function loadCsvObjects<T extends Record<string, string | number | undefined>>(
	filePath: string,
): Promise<T[]> {
	const text = await Bun.file(filePath).text();
	const rows = parseCsv(text);
	if (rows.length === 0) return [];
	const headers = rows[0];
	const dataRows = rows.slice(1);

	return dataRows.map((row) => {
		const obj: Record<string, string> = {};
		row.forEach((value, idx) => {
			obj[headers[idx]] = value;
		});
		return obj as T;
	});
}

async function loadStops(filePath: string): Promise<Map<string, StopRow>> {
	const text = await Bun.file(filePath).text();
	const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
	const headers = parseCsvLine(headerLine);
	const stopIdIdx = headers.indexOf("stop_id");
	const stopCodeIdx = headers.indexOf("stop_code");
	const stopNameIdx = headers.indexOf("stop_name");
	const map = new Map<string, StopRow>();

	for (const line of lines) {
		const cols = parseCsvLine(line);
		const stop: StopRow = {
			stop_id: cols[stopIdIdx],
			stop_code: cols[stopCodeIdx],
			stop_name: cols[stopNameIdx],
		};
		if (stop.stop_code) {
			map.set(stop.stop_code, stop);
		}
	}

	return map;
}

async function loadRoutes(filePath: string): Promise<Map<string, RouteRow>> {
	const routes = await loadCsvObjects<RouteRow>(filePath);
	const map = new Map<string, RouteRow>();
	for (const route of routes) {
		map.set(route.route_id, route);
	}
	return map;
}

async function loadTrips(filePath: string): Promise<Map<string, TripRow>> {
	const trips = await loadCsvObjects<TripRow>(filePath);
	const map = new Map<string, TripRow>();
	for (const trip of trips) {
		map.set(trip.trip_id, trip);
	}
	return map;
}

async function loadShapes(filePath: string): Promise<Map<string, ShapePoint[]>> {
	const text = await Bun.file(filePath).text();
	const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
	const headers = parseCsvLine(headerLine);
	const idx = {
		shape: headers.indexOf("shape_id"),
		lat: headers.indexOf("shape_pt_lat"),
		lon: headers.indexOf("shape_pt_lon"),
		seq: headers.indexOf("shape_pt_sequence"),
	};

	const map = new Map<string, ShapePoint[]>();

	for (const line of lines) {
		const cols = parseCsvLine(line);
		const shapeId = cols[idx.shape];
		if (!shapeId) continue;
		const point: ShapePoint = {
			shape_id: shapeId,
			shape_pt_lat: Number.parseFloat(cols[idx.lat] ?? "0"),
			shape_pt_lon: Number.parseFloat(cols[idx.lon] ?? "0"),
			shape_pt_sequence: toInt(cols[idx.seq] ?? "0") || 0,
		};

		const list = map.get(shapeId) ?? [];
		list.push(point);
		if (!map.has(shapeId)) map.set(shapeId, list);
	}

	for (const list of map.values()) {
		list.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);
	}

	return map;
}

async function loadStopTimes(
	filePath: string,
): Promise<Map<string, StopTimeRow[]>> {
	const text = await Bun.file(filePath).text();
	const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
	const headers = parseCsvLine(headerLine);
	const idx = {
		trip: headers.indexOf("trip_id"),
		arr: headers.indexOf("arrival_time"),
		dep: headers.indexOf("departure_time"),
		stop: headers.indexOf("stop_id"),
		seq: headers.indexOf("stop_sequence"),
	};

	const map = new Map<string, StopTimeRow[]>();

	for (const line of lines) {
		const cols = parseCsvLine(line);
		const departure_time = cols[idx.dep];
		const stop_id = cols[idx.stop];
		if (!stop_id || !departure_time) continue;

		const row: StopTimeRow = {
			trip_id: cols[idx.trip],
			arrival_time: cols[idx.arr],
			departure_time,
			stop_id,
			stop_sequence: toInt(cols[idx.seq] ?? "0") || 0,
			departureMinutes: gtfsTimeToMinutes(departure_time),
		};

		const list = map.get(stop_id) ?? [];
		list.push(row);
		if (!map.has(stop_id)) map.set(stop_id, list);
	}

	for (const list of map.values()) {
		list.sort((a, b) => a.departureMinutes - b.departureMinutes);
	}

	return map;
}

async function loadCalendar(filePath: string): Promise<Map<string, CalendarRow>> {
	const rows = await loadCsvObjects<CalendarRow>(filePath);
	const map = new Map<string, CalendarRow>();
	for (const row of rows) {
		map.set(row.service_id, {
			...row,
			monday: toInt(String(row.monday)),
			tuesday: toInt(String(row.tuesday)),
			wednesday: toInt(String(row.wednesday)),
			thursday: toInt(String(row.thursday)),
			friday: toInt(String(row.friday)),
			saturday: toInt(String(row.saturday)),
			sunday: toInt(String(row.sunday)),
		});
	}
	return map;
}

async function loadCalendarDates(
	filePath: string,
): Promise<Map<string, CalendarDateRow[]>> {
	const rows = await loadCsvObjects<CalendarDateRow>(filePath);
	const map = new Map<string, CalendarDateRow[]>();
	for (const row of rows) {
		const list = map.get(row.service_id) ?? [];
		list.push({
			...row,
			exception_type: toInt(String(row.exception_type)),
		});
		if (!map.has(row.service_id)) map.set(row.service_id, list);
	}
	return map;
}

async function loadDatasetFromPath(datasetPath: string, datasetId: string): Promise<GtfsData> {
	return {
		datasetId,
		routes: await loadRoutes(join(datasetPath, "routes.txt")),
		trips: await loadTrips(join(datasetPath, "trips.txt")),
		shapes: await loadShapes(join(datasetPath, "shapes.txt")),
		stopsByCode: await loadStops(join(datasetPath, "stops.txt")),
		stopTimesByStopId: await loadStopTimes(join(datasetPath, "stop_times.txt")),
		calendar: await loadCalendar(join(datasetPath, "calendar.txt")),
		calendarDates: await loadCalendarDates(join(datasetPath, "calendar_dates.txt")),
	};
}

function findExistingDatasetDir(storageDir: string): string | null {
	if (!existsSync(storageDir)) return null;
	// pick first folder that has required files
	try {
		const entries = readdirSync(storageDir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const dirPath = join(storageDir, entry.name);
			const hasAll = REQUIRED_FILES.every((file) => existsSync(join(dirPath, file)));
			if (hasAll) return dirPath;
		}
	} catch (_err) {
		return null;
	}
	return null;
}

export async function loadGtfsDataset(): Promise<GtfsDataset> {
	const storageDir = process.env.GTFS_DATA_DIR ?? DEFAULT_STORAGE;
	ensureDir(storageDir);

	const latestId = await fetchLatestDatasetId();
	let datasetId = latestId ?? "local";
	let datasetPath = latestId ? join(storageDir, latestId) : null;

	if (datasetPath && !existsSync(datasetPath)) {
		try {
			await downloadAndExtract(latestId!, datasetPath);
		} catch (err) {
			console.error("Failed to download GTFS dataset, falling back to existing", err);
			datasetPath = null;
		}
	}

	if (!datasetPath || !REQUIRED_FILES.every((f) => existsSync(join(datasetPath, f)))) {
		datasetPath = findExistingDatasetDir(storageDir);
		if (datasetPath) {
			datasetId = datasetPath.split(/[/\\]/).pop() ?? datasetId;
		}
	}

	if (!datasetPath) {
		// last resort: bundled snapshot for local development
		datasetPath = LOCAL_FALLBACK;
		datasetId = "bundled";
	}

	const data = await loadDatasetFromPath(datasetPath, datasetId);
	return { data, loadedFrom: datasetPath };
}