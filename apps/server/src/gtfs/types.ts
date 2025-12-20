export type StopRow = {
	stop_id: string;
	stop_code: string;
	stop_name: string;
};

export type RouteRow = {
	route_id: string;
	route_short_name: string;
	route_long_name: string;
	route_color?: string;
	route_text_color?: string;
};

export type TripRow = {
	trip_id: string;
	route_id: string;
	service_id: string;
	trip_headsign?: string;
	direction_id?: string;
};

export type StopTimeRow = {
	trip_id: string;
	arrival_time: string;
	departure_time: string;
	stop_id: string;
	stop_sequence: number;
	departureMinutes: number;
};

export type CalendarRow = {
	service_id: string;
	monday: number;
	tuesday: number;
	wednesday: number;
	thursday: number;
	friday: number;
	saturday: number;
	sunday: number;
	start_date: string;
	end_date: string;
};

export type CalendarDateRow = {
	service_id: string;
	date: string;
	exception_type: number;
};

export type GtfsData = {
	datasetId: string;
	routes: Map<string, RouteRow>;
	trips: Map<string, TripRow>;
	stopsByCode: Map<string, StopRow>;
	stopTimesByStopId: Map<string, StopTimeRow[]>;
	calendar: Map<string, CalendarRow>;
	calendarDates: Map<string, CalendarDateRow[]>;
};

export type ScheduledDepartureDto = {
	lineRef: string;
	destination: string;
	departureTime: string; // HH:MM for display
	departureTimestamp: number; // epoch millis
	tripId: string;
	routeColor?: string;
	routeTextColor?: string;
	routeId: string;
};

export type StopScheduleResponse = {
	status: "ok" | "error";
	departures?: ScheduledDepartureDto[];
	message?: string;
	datasetId?: string;
	generatedAt?: number;
};

export type ScheduleDay = {
	date: string; // YYYYMMDD
	departures: ScheduledDepartureDto[];
};

export type StopScheduleRangeResponse = {
	status: "ok" | "error";
	days?: ScheduleDay[];
	message?: string;
	datasetId?: string;
	generatedAt?: number;
};