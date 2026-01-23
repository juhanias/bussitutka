import { Search } from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { BusStop } from "../types/transport";

const MAX_RESULTS = 50;

interface StopSearchProps {
	isOpen: boolean;
	stops: BusStop[];
	onSelect: (stop: BusStop) => void;
	onClose: () => void;
}

function StopSearch({ isOpen, stops, onSelect, onClose }: StopSearchProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		setQuery("");
		setActiveIndex(0);
		// wait for the dialog to paint before focusing to avoid scroll jumps
		requestAnimationFrame(() => inputRef.current?.focus());
	}, [isOpen]);

	const normalizedQuery = query.trim().toLowerCase();

	const filteredStops = useMemo(() => {
		if (!normalizedQuery) {
			return stops.slice(0, MAX_RESULTS);
		}

		const terms = normalizedQuery.split(/\s+/).filter(Boolean);

		return stops
			.filter((stop) => {
				const code = stop.stop_code.toLowerCase();
				const name = stop.stop_name.toLowerCase();
				return terms.every(
					(term) => code.includes(term) || name.includes(term),
				);
			})
			.slice(0, MAX_RESULTS);
	}, [stops, normalizedQuery]);

	// biome-ignore lint: reset index when query/filter changes
	useEffect(() => {
		setActiveIndex(0);
	}, [normalizedQuery]);

	const handleSelect = (stop: BusStop) => {
		onSelect(stop);
	};

	const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((prev) =>
				Math.min(prev + 1, Math.max(filteredStops.length - 1, 0)),
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((prev) => Math.max(prev - 1, 0));
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const target = filteredStops[activeIndex];
			if (target) {
				handleSelect(target);
			}
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-xl">
				<div className="flex items-center border-b border-border px-4 py-3">
					<Search className="mr-3 h-5 w-5 text-muted-foreground" />
					<input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleInputKeyDown}
						className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
						placeholder="search stops..."
						aria-label="Search stops"
					/>
					<div className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:block">
						ESC
					</div>
				</div>

				<div className="max-h-[60vh] overflow-y-auto p-2">
					{filteredStops.length === 0 ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							Ei tuloksia
						</div>
					) : (
						<ul className="space-y-0.5">
							{filteredStops.map((stop, index) => (
								<li key={stop.stop_code}>
									<button
										type="button"
										onClick={() => handleSelect(stop)}
										className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
											index === activeIndex
												? "bg-primary/15 text-primary"
												: "text-foreground/80 hover:bg-muted hover:text-foreground"
										}`}
									>
										<span className="truncate font-medium">
											{stop.stop_name}
										</span>
										<span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
											{stop.stop_code}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default StopSearch;
