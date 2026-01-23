import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CustomStopNamesStore {
	customNames: Map<string, string>;
	getDisplayName: (stopCode: string, originalName: string) => string;
	setCustomName: (stopCode: string, customName: string) => void;
	resetCustomName: (stopCode: string) => void;
}

export const useCustomStopNamesStore = create<CustomStopNamesStore>()(
	persist(
		(set, get) => ({
			customNames: new Map<string, string>(),
			getDisplayName: (stopCode: string, originalName: string) => {
				const custom = get().customNames.get(stopCode);
				return custom || originalName;
			},
			setCustomName: (stopCode: string, customName: string) => {
				set((state) => {
					const updated = new Map(state.customNames);
					if (customName.trim()) {
						updated.set(stopCode, customName.trim());
					} else {
						updated.delete(stopCode);
					}
					return { customNames: updated };
				});
			},
			resetCustomName: (stopCode: string) => {
				set((state) => {
					const updated = new Map(state.customNames);
					updated.delete(stopCode);
					return { customNames: updated };
				});
			},
		}),
		{
			name: "bussit-custom-stop-names",
			storage: {
				getItem: (name) => {
					const serialized = localStorage.getItem(name);
					if (!serialized) return null;
					const parsed = JSON.parse(serialized);
					return {
						...parsed,
						state: {
							...parsed.state,
							customNames: new Map(parsed.state.customNames || []),
						},
					};
				},
				setItem: (name, value) => {
					const payload = {
						...value,
						state: {
							...value.state,
							customNames: Array.from(value.state.customNames),
						},
					};
					localStorage.setItem(name, JSON.stringify(payload));
				},
				removeItem: (name) => localStorage.removeItem(name),
			},
		},
	),
);
