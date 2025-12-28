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
	const formatDateLabel = (dateObj: Date) =>
		dateObj.toLocaleDateString("fi-FI", {
			weekday: "short",
			day: "numeric",
			month: "numeric",
		});

	const addDaysToDateString = (dateStr: string, days: number): string => {
		const year = Number(dateStr.slice(0, 4));
		const month = Number(dateStr.slice(4, 6)) - 1;
		const day = Number(dateStr.slice(6, 8));
		const d = new Date(Date.UTC(year, month, day));
		d.setUTCDate(d.getUTCDate() + days);
		const yyyy = d.getUTCFullYear();
		const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
		const dd = String(d.getUTCDate()).padStart(2, "0");
		return `${yyyy}${mm}${dd}`;
	};

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

			// prepare containers for each requested day
			const dayIndexByDate = new Map<string, number>();
			const parsedDays: ScheduleDay[] = daysPayload.map((day, idx) => {
				dayIndexByDate.set(day.date, idx);
				const dateObj = new Date(
					`${day.date.slice(0, 4)}-${day.date.slice(4, 6)}-${day.date.slice(6, 8)}`,
				);
				return {
					date: day.date,
					label: formatDateLabel(dateObj),
					departures: [],
				};
			});

			// distribute departures to the correct service day, falling back to same day if target missing
			for (const day of daysPayload) {
				for (const dep of day.departures) {
					const departureDate = new Date(dep.departureTimestamp);
					const targetDate = dep.serviceDayOffset
						? addDaysToDateString(day.date, dep.serviceDayOffset)
						: day.date;
					const targetIndex =
						dayIndexByDate.get(targetDate) ?? dayIndexByDate.get(day.date);
					if (targetIndex === undefined) continue;
					const displayTime = departureDate.toLocaleTimeString("fi-FI", {
						hour: "2-digit",
						minute: "2-digit",
					});
					parsedDays[targetIndex].departures.push({
						...dep,
						departureTime: displayTime,
						departureDate,
					});
				}
			}

			// sort departures inside each day chronologically
			parsedDays.forEach((day) => {
				day.departures.sort(
					(a, b) => a.departureDate.getTime() - b.departureDate.getTime(),
				);
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
