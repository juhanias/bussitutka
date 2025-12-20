import { useCallback, useEffect, useRef, useState } from "react";

import { SCHEDULE_ENDPOINT } from "../constants/endpoints";
import type { ScheduleDay, ScheduledDeparture } from "../types/transport";

type StopScheduleApiResponse = {
	status: "ok" | "error";
	departures?: Array<
		Omit<ScheduledDeparture, "departureDate"> & {
			departureTimestamp: number;
		}
	>;
	days?: Array<{
		date: string;
		departures: Array<
			Omit<ScheduledDeparture, "departureDate"> & {
				departureTimestamp: number;
			}
		>;
	}>;
	message?: string;
};

interface UseStopScheduleResult {
	scheduleDays: ScheduleDay[];
	loading: boolean;
	error: string | null;
	refetch: () => void;
}

export function useStopSchedule(
	stopCode: string | null,
): UseStopScheduleResult {
	const [scheduleDays, setScheduleDays] = useState<ScheduleDay[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const fetchSchedule = useCallback(async () => {
		if (!stopCode) {
			setScheduleDays([]);
			return;
		}

		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();

		setLoading(true);
		setError(null);

		try {
			const res = await fetch(SCHEDULE_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stopCode, days: 7, maxPerDay: 1000 }),
				signal: abortControllerRef.current.signal,
			});

			if (!res.ok) {
				throw new Error(`schedule endpoint responded ${res.status}`);
			}

			const data = (await res.json()) as StopScheduleApiResponse;
			if (data.status === "error") {
				setError(data.message ?? "Aikataulun lataus epäonnistui");
				setScheduleDays([]);
				return;
			}

			// prefer multi-day payload; fall back to single-day for safety
			const daysPayload = data.days ?? [
				{
					date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
					departures: data.departures ?? [],
				},
			];

			const parsedDays: ScheduleDay[] = daysPayload.map((day) => {
				const dateObj = new Date(
					`${day.date.slice(0, 4)}-${day.date.slice(4, 6)}-${day.date.slice(6, 8)}`,
				);
				const departures = day.departures
					.map((dep) => ({
						...dep,
						departureDate: new Date(dep.departureTimestamp),
					}))
					.sort(
						(a, b) => a.departureDate.getTime() - b.departureDate.getTime(),
					);
				return {
					date: day.date,
					label: dateObj.toLocaleDateString("fi-FI", {
						weekday: "short",
						day: "numeric",
						month: "numeric",
					}),
					departures,
				};
			});

			setScheduleDays(parsedDays);
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				return;
			}
			console.error("Failed to fetch schedule via backend:", err);
			setError("Aikataulun lataus epäonnistui");
			setScheduleDays([]);
		} finally {
			setLoading(false);
		}
	}, [stopCode]);

	useEffect(() => {
		fetchSchedule();

		return () => {
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, [fetchSchedule]);

	return { scheduleDays, loading, error, refetch: fetchSchedule };
}
