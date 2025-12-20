import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FavoritesStore {
	favoriteStops: Set<string>;
	toggleFavorite: (stopCode: string) => void;
	isFavorite: (stopCode: string) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
	persist(
		(set, get) => ({
			favoriteStops: new Set<string>(),
			toggleFavorite: (stopCode: string) => {
				set((state) => {
					const updated = new Set(state.favoriteStops);
					if (updated.has(stopCode)) {
						updated.delete(stopCode);
					} else {
						updated.add(stopCode);
					}
					return {
						favoriteStops: updated,
					};
				});
			},
			isFavorite: (stopCode: string) => get().favoriteStops.has(stopCode),
		}),
		{
			name: "bussit-favorites",
			storage: {
				getItem: (name) => {
					const serialized = localStorage.getItem(name);
					if (!serialized) return null;
					const parsed = JSON.parse(serialized);
					return {
						...parsed,
						state: {
							...parsed.state,
							favoriteStops: new Set(parsed.state.favoriteStops || []),
						},
					};
				},
				setItem: (name, value) => {
					const payload = {
						...value,
						state: {
							...value.state,
							favoriteStops: Array.from(value.state.favoriteStops),
						},
					};
					localStorage.setItem(name, JSON.stringify(payload));
				},
				removeItem: (name) => localStorage.removeItem(name),
			},
		},
	),
);
