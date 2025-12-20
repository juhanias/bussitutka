import {
	CalendarDateRow,
	CalendarRow,
	GtfsData,
	ScheduleDay,
	ScheduledDepartureDto,
	StopScheduleRangeResponse,
	StopScheduleResponse,
	StopTimeRow,
} from "./types";

const MAX_DEPARTURES = Number(process.env.SCHEDULE_MAX_DEPARTURES ?? 20);
const MAX_DAYS = Number(process.env.SCHEDULE_MAX_DAYS ?? 7);
const MAX_PER_DAY = Number(process.env.SCHEDULE_MAX_PER_DAY ?? 1000);

const pad2 = (n: number) => n.toString().padStart(2, "0");

const formatHhMm = (minutes: number): string => {
	const hh = Math.floor(minutes / 60) % 24;
	const mm = minutes % 60;
	return `${pad2(hh)}:${pad2(mm)}`;
};

const dateToYyyymmdd = (date: Date): string => {
	const yyyy = date.getFullYear();
	const mm = pad2(date.getMonth() + 1);
	const dd = pad2(date.getDate());
	return `${yyyy}${mm}${dd}`;
};

const minutesSinceMidnight = (date: Date): number =>
	date.getHours() * 60 + date.getMinutes();

const isInRange = (dateStr: string, start: string, end: string) =>
	dateStr >= start && dateStr <= end;

// gtfs spec: exception_type 1 = service added, 2 = removed
const isExceptionAdded = (exceptions: CalendarDateRow[] | undefined, date: string) =>
	exceptions?.some((e) => e.date === date && e.exception_type === 1) ?? false;

const isExceptionRemoved = (
	exceptions: CalendarDateRow[] | undefined,
	date: string,
) => exceptions?.some((e) => e.date === date && e.exception_type === 2) ?? false;

const isServiceActive = (
	calendar: CalendarRow | undefined,
	exceptions: CalendarDateRow[] | undefined,
	dayOfWeek: number,
	dateStr: string,
): boolean => {
	// foli uses calendar_dates as authoritative; calendar.txt may be all zeros
	// https://data.foli.fi/doc/gtfs/v0/calendar
	if (!calendar) {
		return isExceptionAdded(exceptions, dateStr);
	}

	if (!isInRange(dateStr, calendar.start_date, calendar.end_date)) {
		return isExceptionAdded(exceptions, dateStr);
	}

	const activeByDay = [
		calendar.sunday,
		calendar.monday,
		calendar.tuesday,
		calendar.wednesday,
		calendar.thursday,
		calendar.friday,
		calendar.saturday,
	];

	const isActive = activeByDay[dayOfWeek] === 1;
	if (isExceptionRemoved(exceptions, dateStr)) return false;
	if (isExceptionAdded(exceptions, dateStr)) return true;
	return isActive;
};

const computeDepartureTimestamp = (baseDate: Date, minutes: number): number => {
	const midnight = new Date(baseDate);
	midnight.setHours(0, 0, 0, 0);
	const adjustedMinutes = minutes;
	return midnight.getTime() + adjustedMinutes * 60_000;
};

const pickStopTimesForDay = (
	stopTimes: StopTimeRow[],
	nowMinutes: number,
	isToday: boolean,
) => (isToday ? stopTimes.filter((t) => t.departureMinutes >= nowMinutes) : stopTimes);

const buildDeparturesForDate = (
	gtfs: GtfsData,
	stopTimes: StopTimeRow[],
	date: Date,
	isToday: boolean,
	nowMinutes: number,
	limit: number,
): ScheduledDepartureDto[] => {
	const dayOfWeek = date.getDay();
	const dateStr = dateToYyyymmdd(date);
	const departures: ScheduledDepartureDto[] = [];

	for (const stopTime of pickStopTimesForDay(stopTimes, nowMinutes, isToday)) {
		const trip = gtfs.trips.get(stopTime.trip_id);
		if (!trip) continue;

		const calendar = gtfs.calendar.get(trip.service_id);
		const exceptions = gtfs.calendarDates.get(trip.service_id);
		if (!isServiceActive(calendar, exceptions, dayOfWeek, dateStr)) continue;

		const route = gtfs.routes.get(trip.route_id);
		if (!route) continue;

		const departureTimestamp = computeDepartureTimestamp(
			date,
			stopTime.departureMinutes,
		);
		departures.push({
			lineRef: route.route_short_name,
			destination: trip.trip_headsign || route.route_long_name,
			departureTime: formatHhMm(stopTime.departureMinutes),
			departureTimestamp,
			tripId: stopTime.trip_id,
			routeColor: route.route_color,
			routeTextColor: route.route_text_color,
			routeId: route.route_id,
		});

		if (departures.length >= limit) break;
	}

	departures.sort((a, b) => a.departureTimestamp - b.departureTimestamp);
	return departures;
};

export function buildStopSchedule(
	gtfs: GtfsData,
	stopCode: string,
	now: Date,
	limit?: number,
): StopScheduleResponse {
	const range = buildStopScheduleRange(gtfs, stopCode, now, 1, limit);
	if (range.status === "error") return range;
	const firstDay = range.days?.[0]?.departures ?? [];
	return {
		status: "ok",
		departures: firstDay.slice(0, limit ?? MAX_DEPARTURES),
		datasetId: gtfs.datasetId,
		generatedAt: range.generatedAt,
	};
}

export function buildStopScheduleRange(
	gtfs: GtfsData,
	stopCode: string,
	start: Date,
	days: number,
	maxPerDay?: number,
): StopScheduleRangeResponse {
	const stop = gtfs.stopsByCode.get(stopCode);
	if (!stop) {
		return { status: "error", message: "stop not found" };
	}

	const stopTimes = gtfs.stopTimesByStopId.get(stop.stop_id) ?? [];
	if (!stopTimes.length) {
		return {
			status: "ok",
			days: [],
			datasetId: gtfs.datasetId,
			generatedAt: Date.now(),
		};
	}

	const clampedDays = Math.min(Math.max(days, 1), MAX_DAYS);
	const perDayLimit = Math.min(maxPerDay ?? MAX_PER_DAY, MAX_PER_DAY);
	const nowMinutes = minutesSinceMidnight(start);
	const scheduleDays: ScheduleDay[] = [];

	for (let i = 0; i < clampedDays; i++) {
		const date = new Date(start);
		date.setHours(0, 0, 0, 0);
		date.setDate(start.getDate() + i);
		const isToday = i === 0;
		const departures = buildDeparturesForDate(
			gtfs,
			stopTimes,
			date,
			isToday,
			nowMinutes,
			perDayLimit,
		);
		scheduleDays.push({ date: dateToYyyymmdd(date), departures });
	}

	return {
		status: "ok",
		days: scheduleDays,
		datasetId: gtfs.datasetId,
		generatedAt: Date.now(),
	};
}