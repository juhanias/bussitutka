export interface BusStop {
	stop_code: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
}

export interface Departure {
	lineref: string;
	destinationdisplay: string;
	expectedarrivaltime: number;
	vehicleatstop: boolean;
	monitored: boolean;
	vehicleref: string;
	__tripref?: string;
}

export interface Vehicle {
	vehicleref: string;
	lineref: string;
	latitude: number;
	longitude: number;
	destinationname: string;
	next_stoppointname: string;
	delaysecs: number;
}

export interface VehiclePosition extends Vehicle {
	fromLat: number;
	fromLon: number;
	toLat: number;
	toLon: number;
	currentLat: number;
	currentLon: number;
	bearing: number | null;
	hasDirection: boolean;
}

export interface StopInfo {
	stop: BusStop | null;
	departures: Departure[];
	loading: boolean;
}

export interface Trip {
	route_id: string;
	shape_id: string;
}

export interface ShapePoint {
	lat: number;
	lon: number;
	traveled: number;
}

// gtfs schedule types
export interface GtfsStopTime {
	trip_id: string;
	arrival_time: string;
	departure_time: string;
	stop_sequence: number;
	stop_headsign: string;
	pickup_type: number;
	drop_off_type: number;
}

export interface GtfsTrip {
	route_id: string;
	service_id: string;
	trip_headsign: string;
	direction_id: number;
	shape_id: string;
}

export interface GtfsRoute {
	route_id: string;
	route_short_name: string;
	route_long_name: string;
	route_color: string;
	route_text_color: string;
}

export interface ScheduledDeparture {
	lineRef: string;
	destination: string;
	departureTime: string; // HH:MM format for display
	departureDate: Date;
	tripId: string;
	routeColor?: string;
	routeTextColor?: string;
	routeId: string;
}

export interface ScheduleDay {
	date: string; // YYYYMMDD
	label: string;
	departures: ScheduledDeparture[];
}
