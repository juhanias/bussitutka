import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useState,
} from "react";
import { getLineColor } from "../constants/layers";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useStopSchedule } from "../hooks/useStopSchedule";
import { useCustomStopNamesStore } from "../store/customStopNames";
import { useFavoritesStore } from "../store/favorites";
import { useUiHintsStore } from "../store/uiHints";
import type { ScheduleDay, StopInfo } from "../types/transport";
import { formatMinutesUntil, formatTime } from "../utils/time";
import { EditStopNameDialog } from "./EditStopNameDialog";
import UiHint from "./UiHint";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
	DrawerTrigger,
} from "./ui/drawer";
import { SidebarSheet } from "./ui/sidebar-sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

type TabType = "realtime" | "schedule";

type StopSidebarProps = {
	stopInfo: StopInfo;
	onClose: () => void;
	onBusClick: (vehicleRef: string) => void;
	trackedVehicleRef: string | null;
	isVisible?: boolean;
};

const MISSING_VEHICLE_TITLE = "Miksi tämä bussi ei ole kartalla?";
const MISSING_VEHICLE_BODY = {
	paragraphs: [
		"Fölin tarjoama sijaintidata on suuntaa antavaa, ja perustuu teknisesti puhuttuna 'arvailuun'.",
		"Mikäli bussin tiellä on tietöitä tai vastaavia järjestelyitä jotka johtavat bussin eroamiseen suunnitellulta polulta, voi Fölin järjestelmä hukata sen.",
		"Tämä verkkopalvelu käyttää Fölin dataa suoraan, joten emme voi näyttää tämän bussin sijaintia.",
	],
} as const;

function MissingVehicleHelp() {
	const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");

	const trigger = (
		<button
			type="button"
			aria-label={MISSING_VEHICLE_TITLE}
			className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-muted-foreground"
			onClick={(e) => e.stopPropagation()}
		>
			?
		</button>
	);

	if (canHover) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>{trigger}</TooltipTrigger>
					<TooltipContent side="left" className="max-w-64 p-3">
						<p className="mb-2 font-semibold">{MISSING_VEHICLE_TITLE}</p>
						{MISSING_VEHICLE_BODY.paragraphs.map((p) => (
							<p key={p} className="mb-2 text-xs text-muted-foreground">
								{p}
							</p>
						))}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<Drawer>
			<DrawerTrigger asChild>{trigger}</DrawerTrigger>
			<DrawerContent>
				<div className="space-y-3 p-4">
					<DrawerTitle>{MISSING_VEHICLE_TITLE}</DrawerTitle>
					<DrawerDescription className="space-y-2 text-xs">
						{MISSING_VEHICLE_BODY.paragraphs.map((p) => (
							<p key={p}>{p}</p>
						))}
					</DrawerDescription>
					<DrawerClose asChild>
						<button
							type="button"
							className="w-full rounded-lg bg-muted px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/80"
						>
							Asia selvä
						</button>
					</DrawerClose>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

function ScheduleList({
	scheduleDays,
	loading,
	error,
}: {
	scheduleDays: ScheduleDay[];
	loading: boolean;
	error: string | null;
}) {
	const withAlpha = (hex: string, alphaHex = "26") => {
		const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
		return `#${normalized}${alphaHex}`;
	};
	const [lineFilter, setLineFilter] = useState<Set<string>>(new Set());
	const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
	const [collapsedHours, setCollapsedHours] = useState<Set<string>>(new Set());
	const scheduleSignature = useMemo(
		() =>
			scheduleDays
				.map((day) => `${day.date}-${day.departures.length}`)
				.join("|"),
		[scheduleDays],
	);

	useEffect(() => {
		// collapse everything when the dataset changes to avoid rendering huge lists at once
		if (!scheduleSignature) return;
		setExpandedDays(new Set());
		setCollapsedHours(new Set());
	}, [scheduleSignature]);

	const lines = useMemo(() => {
		const uniq = new Set<string>();
		for (const day of scheduleDays) {
			for (const dep of day.departures) {
				uniq.add(dep.lineRef);
			}
		}
		return Array.from(uniq).sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
	}, [scheduleDays]);

	const filteredDays = useMemo(() => {
		if (!lineFilter.size) return scheduleDays;
		return scheduleDays
			.map((day) => ({
				...day,
				departures: day.departures.filter((dep) => lineFilter.has(dep.lineRef)),
			}))
			.filter((day) => day.departures.length > 0);
	}, [lineFilter, scheduleDays]);

	const toggleLine = (line: string) => {
		setLineFilter((prev) => {
			const next = new Set(prev);
			if (next.has(line)) {
				next.delete(line);
			} else {
				next.add(line);
			}
			return next;
		});
	};

	const toggleDay = (date: string) => {
		setExpandedDays((prev) => {
			const next = new Set(prev);
			if (next.has(date)) {
				next.delete(date);
			} else {
				next.add(date);
			}
			return next;
		});
	};

	if (loading) {
		return (
			<div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
				<span className="text-sm">Ladataan aikataulua...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
				<span className="text-2xl">⚠</span>
				<span className="text-sm">{error}</span>
			</div>
		);
	}

	if (scheduleDays.length === 0) {
		return (
			<div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
				<span className="text-2xl">∅</span>
				<span className="text-sm">Ei aikataulutietoja</span>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			{lines.length > 0 && (
				<div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
					<div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
						<span>Linjat</span>
						<span className="text-[11px] font-semibold text-foreground/70">
							{lineFilter.size || lines.length}/{lines.length}
						</span>
					</div>
					<div className="flex flex-wrap gap-2">
						{lines.map((line) => {
							const isActive = lineFilter.has(line);
							const color = getLineColor(line);
							const activeStyle = isActive
								? {
										color,
										backgroundColor: withAlpha(color, "26"),
										borderColor: withAlpha(color, "4d"),
									}
								: undefined;

							return (
								<button
									key={line}
									type="button"
									onClick={() => toggleLine(line)}
									className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
										isActive
											? "shadow-sm"
											: "border-transparent bg-background text-foreground/80 hover:border-muted"
									}`}
									style={activeStyle}
								>
									{line}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{filteredDays.map((day) => {
				const isExpanded = expandedDays.has(day.date);
				const departuresByHour = day.departures.reduce(
					(acc, dep) => {
						const hour = dep.departureDate.getHours();
						const bucket = acc[hour] ?? [];
						bucket.push(dep);
						acc[hour] = bucket;
						return acc;
					},
					{} as Record<number, ScheduleDay["departures"]>,
				);
				const hours = Object.entries(departuresByHour).sort(
					(a, b) => Number(a[0]) - Number(b[0]),
				);

				return (
					<div
						key={day.date}
						className="overflow-hidden rounded-lg border border-border bg-card"
					>
						<button
							type="button"
							onClick={() => toggleDay(day.date)}
							className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
						>
							<div className="flex flex-col">
								<span className="text-sm font-semibold text-foreground">
									{day.label}
								</span>
								<span className="text-xs text-muted-foreground">
									{day.departures.length} lähtöä
								</span>
							</div>
							<span className="text-lg font-bold text-muted-foreground">
								{isExpanded ? "-" : "+"}
							</span>
						</button>

						{isExpanded && (
							<div className="space-y-3 px-4 pb-4">
								{hours.length === 0 && (
									<div className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground">
										Ei lähtöjä
									</div>
								)}

								{hours.map(([hour, departures]) => {
									const headway =
										departures.length > 2
											? Math.round(60 / departures.length)
											: null;
									const hourNumber = Number(hour);
									const hourLabel = `${hourNumber.toString().padStart(2, "0")}:00`;
									const hourKey = `${day.date}-${hour}`;
									const isHourCollapsed = collapsedHours.has(hourKey);

									return (
										<div
											key={`${day.date}-${hour}`}
											className="rounded-lg border border-border bg-background/60 px-3 py-2.5"
										>
											<button
												type="button"
												onClick={() => {
													setCollapsedHours((prev) => {
														const next = new Set(prev);
														if (next.has(hourKey)) {
															next.delete(hourKey);
														} else {
															next.add(hourKey);
														}
														return next;
													});
												}}
												className="mb-2 flex w-full items-center justify-between text-left text-xs text-muted-foreground"
											>
												<span className="font-semibold">{hourLabel}</span>
												<span className="flex items-center gap-2">
													{headway ? <span>≈ joka {headway} min</span> : null}
													<span className="text-base font-bold text-foreground">
														{isHourCollapsed ? "+" : "-"}
													</span>
												</span>
											</button>

											{!isHourCollapsed && (
												<div className="space-y-2">
													{departures.map((dep) => {
														const textColor = dep.routeColor
															? `#${dep.routeColor}`
															: getLineColor(dep.lineRef);
														return (
															<div
																key={`${dep.tripId}-${dep.departureTime}`}
																className="flex items-center justify-between gap-3"
															>
																<div className="flex min-w-0 items-center gap-3">
																	<div
																		className="w-10 text-center text-base font-bold"
																		style={{ color: textColor }}
																	>
																		{dep.lineRef}
																	</div>
																	<div className="min-w-0">
																		<div className="truncate text-sm font-medium text-foreground/90">
																			{dep.destination}
																		</div>
																	</div>
																</div>
																<div className="text-sm font-semibold text-muted-foreground">
																	{dep.departureTime}
																</div>
															</div>
														);
													})}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

function StopSidebar({
	stopInfo,
	onClose,
	onBusClick,
	trackedVehicleRef,
	isVisible = true,
}: StopSidebarProps) {
	const [activeTab, setActiveTab] = useState<TabType>("realtime");
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const { favoriteStops, toggleFavorite } = useFavoritesStore();
	const { getDisplayName } = useCustomStopNamesStore();
	const dismissHint = useUiHintsStore((state) => state.dismissHint);
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const [lastStop, setLastStop] = useState(stopInfo.stop);

	useEffect(() => {
		if (stopInfo.stop) {
			setLastStop(stopInfo.stop);
		}
	}, [stopInfo.stop]);

	const isOpen = Boolean(stopInfo.stop) && isVisible;
	const stop = stopInfo.stop || lastStop;

	const {
		scheduleDays,
		loading: scheduleLoading,
		error: scheduleError,
	} = useStopSchedule(activeTab === "schedule" && stop ? stop.stop_code : null);

	if (!stop) return null;

	const isFavorite = favoriteStops.has(stop.stop_code);
	const displayName = getDisplayName(stop.stop_code, stop.stop_name);

	const Content = (
		<div className="flex h-full flex-col text-foreground">
			<div className="flex items-start justify-between gap-4 px-5 pt-6 pb-2">
				<div className="min-w-0 flex-1 text-left">
					<div className="mb-1 text-xs font-medium tracking-wider text-muted-foreground">
						Pysäkki {stop.stop_code}
					</div>
					<div className="mb-1 flex items-center gap-2">
						<h2 className="truncate text-2xl font-bold leading-tight text-foreground">
							{displayName}
						</h2>
						<button
							type="button"
							onClick={() => setEditDialogOpen(true)}
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
							title="Muokkaa pysäkin lempinimeä"
						>
							✎
						</button>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						type="button"
						onClick={() => toggleFavorite(stop.stop_code)}
						className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
						title={isFavorite ? "Poista suosikeista" : "Lisää suosikiksi"}
					>
						{isFavorite ? "★" : "☆"}
					</button>
					{isDesktop ? (
						<button
							type="button"
							onClick={onClose}
							className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
						>
							✕
						</button>
					) : (
						<DrawerClose asChild>
							<button
								type="button"
								className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
							>
								✕
							</button>
						</DrawerClose>
					)}
				</div>
			</div>

			<div className="px-5 pb-3">
				<div className="flex rounded-lg bg-muted p-1">
					<button
						type="button"
						onClick={() => setActiveTab("realtime")}
						className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
							activeTab === "realtime"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Juuri nyt
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("schedule")}
						className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
							activeTab === "schedule"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Aikataulu
					</button>
				</div>
			</div>

			<UiHint
				id="busstop.mapview.hint"
				condition={activeTab === "realtime" && stopInfo.departures.length > 0}
				className="px-5 pb-2 text-center text-xs italic text-muted-foreground/80"
			>
				↓ Napauta linjaa nähdäksesi sen kartalla! ↓
			</UiHint>

			<div className="flex-1 overflow-y-auto px-5 pb-6 scrollbar-thin">
				{activeTab === "realtime" ? (
					stopInfo.loading ? (
						<div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
							<span className="text-sm">Ladataan...</span>
						</div>
					) : stopInfo.departures.length === 0 ? (
						<div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
							<span className="text-2xl">∅</span>
							<span className="text-sm">Ei lähtöjä</span>
						</div>
					) : (
						<div className="space-y-1">
							{stopInfo.departures.map((dep, i) => {
								const isTracked = trackedVehicleRef === dep.vehicleref;
								const hasVehicle = Boolean(dep.vehicleref);
								const baseClass =
									"group flex w-full items-center gap-4 rounded-lg p-3 text-left transition-all";
								const variantClass = isTracked
									? "bg-primary/15 ring-1 ring-primary/40"
									: hasVehicle
										? "cursor-pointer hover:bg-muted"
										: "opacity-50";
								const arrivalLabel = dep.vehicleatstop
									? "Nyt"
									: formatMinutesUntil(dep.expectedarrivaltime);

								const content = (
									<>
										<div
											className={`w-10 text-center text-xl font-bold ${isTracked ? "text-primary" : "text-foreground"}`}
										>
											{dep.lineref}
										</div>

										<div className="min-w-0 flex-1">
											<div className="truncate text-base font-medium text-foreground/90">
												{dep.destinationdisplay}
											</div>
											<div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
												<span>{formatTime(dep.expectedarrivaltime)}</span>
												{hasVehicle && (
													<span
														className={`transition-colors ${
															isTracked
																? "text-primary"
																: "group-hover:text-foreground/60"
														}`}
													>
														• {isTracked ? "seurataan" : "kartalla"}
													</span>
												)}
											</div>
										</div>

										<div className="flex items-center gap-2">
											{!hasVehicle && <MissingVehicleHelp />}

											<div className="min-w-14 text-right">
												<div
													className={`text-lg font-bold ${
														dep.vehicleatstop
															? "text-emerald-400"
															: isTracked
																? "text-primary"
																: "text-foreground"
													}`}
												>
													{arrivalLabel}
												</div>
											</div>
										</div>
									</>
								);

								if (hasVehicle) {
									return (
										<button
											key={dep.vehicleref ?? dep.__tripref ?? i}
											type="button"
											className={`${baseClass} ${variantClass}`}
											onKeyUp={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
												if (e.key === "Enter" || e.key === " ") {
													onBusClick(dep.vehicleref);
												}
											}}
											onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
												if (e.key === " ") e.preventDefault();
											}}
											onClick={() => {
												dismissHint("busstop.mapview.hint");
												onBusClick(dep.vehicleref);
											}}
										>
											{content}
										</button>
									);
								}

								return (
									<div
										key={dep.vehicleref ?? dep.__tripref ?? i}
										className={`${baseClass} ${variantClass}`}
										aria-disabled="true"
									>
										{content}
									</div>
								);
							})}
						</div>
					)
				) : (
					<ScheduleList
						scheduleDays={scheduleDays}
						loading={scheduleLoading}
						error={scheduleError}
					/>
				)}
			</div>
		</div>
	);

	if (isDesktop) {
		return (
			<>
				<SidebarSheet
					open={isOpen}
					side="left"
					className="h-full w-96 border border-border bg-[var(--stop-panel-background)] backdrop-blur-xl"
				>
					{Content}
				</SidebarSheet>
				{stop && (
					<EditStopNameDialog
						open={editDialogOpen}
						onOpenChange={setEditDialogOpen}
						stopCode={stop.stop_code}
						originalName={stop.stop_name}
					/>
				)}
			</>
		);
	}

	return (
		<>
			<Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DrawerContent className="h-[85vh] bg-[var(--stop-panel-background)]">
					<DrawerTitle className="sr-only">{stop.stop_name}</DrawerTitle>
					<DrawerDescription className="sr-only">
						Pysäkin tiedot
					</DrawerDescription>
					<div className="mx-auto h-full w-full max-w-md">{Content}</div>
				</DrawerContent>
			</Drawer>
			{stop && (
				<EditStopNameDialog
					open={editDialogOpen}
					onOpenChange={setEditDialogOpen}
					stopCode={stop.stop_code}
					originalName={stop.stop_name}
				/>
			)}
		</>
	);
}

export default StopSidebar;
