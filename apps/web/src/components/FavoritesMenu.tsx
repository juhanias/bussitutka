import { MapPin, Star, Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { BusStop } from "../types/transport";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

type FavoriteStopsMenuProps = {
	isOpen: boolean;
	favorites: BusStop[];
	missingCount?: number;
	onSelect: (stop: BusStop) => void;
	onRemove: (stopCode: string) => void;
	onClose: () => void;
};

function FavoritesMenu({
	isOpen,
	favorites,
	missingCount = 0,
	onSelect,
	onRemove,
	onClose,
}: FavoriteStopsMenuProps) {
	const sortedFavorites = useMemo(
		() =>
			favorites.slice().sort((a, b) =>
				a.stop_name.localeCompare(b.stop_name, undefined, {
					sensitivity: "base",
				}),
			),
		[favorites],
	);

	const handleSelect = (stop: BusStop) => {
		onSelect(stop);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="gap-0 p-0 sm:max-w-md">
				<DialogHeader className="border-b border-white/10 px-6 py-4">
					<DialogTitle className="text-lg font-semibold text-white">
						Favorite Stops
					</DialogTitle>
					<DialogDescription className="text-white/60">
						Manage your saved stops
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-[60vh] overflow-y-auto p-2">
					{sortedFavorites.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<div className="mb-4 rounded-full bg-white/5 p-3">
								<Star className="h-6 w-6 text-white/20" />
							</div>
							<p className="text-sm font-medium text-white/80">
								No favorites yet
							</p>
							<p className="mt-1 text-xs text-white/50">
								Star stops to see them here
							</p>
						</div>
					) : (
						<ul className="space-y-1">
							{sortedFavorites.map((stop) => (
								<li key={stop.stop_code}>
									<div className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/5">
										<button
											type="button"
											onClick={() => handleSelect(stop)}
											className="flex flex-1 items-center gap-3 overflow-hidden text-left outline-none"
										>
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
												<MapPin className="h-4 w-4" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium text-white">
													{stop.stop_name}
												</p>
												<p className="truncate text-xs text-white/50">
													{stop.stop_code}
												</p>
											</div>
										</button>

										<button
											type="button"
											onClick={() => onRemove(stop.stop_code)}
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/20 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:bg-red-500/20 focus-visible:text-red-400 focus-visible:outline-none"
											aria-label={`remove ${stop.stop_name} from favorites`}
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</li>
							))}
						</ul>
					)}

					{missingCount > 0 && (
						<div className="m-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200/80">
							{missingCount} saved stop{missingCount === 1 ? "" : "s"} are no
							longer in the current schedule data.
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default FavoritesMenu;
