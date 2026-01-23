import { create } from "zustand";
import { persist } from "zustand/middleware";

const UI_HINTS_STORAGE_KEY = "bussit-ui-hints";

type UiHintsStore = {
	dismissedHints: Set<string>;
	dismissHint: (id: string) => void;
	isHintDismissed: (id: string) => boolean;
};

export const useUiHintsStore = create<UiHintsStore>()(
	persist(
		(set, get) => ({
			dismissedHints: new Set<string>(),
			dismissHint: (id: string) => {
				set((state) => {
					if (state.dismissedHints.has(id)) {
						return state;
					}
					const updated = new Set(state.dismissedHints);
					updated.add(id);
					return { dismissedHints: updated };
				});
			},
			isHintDismissed: (id: string) => get().dismissedHints.has(id),
		}),
		{
			name: UI_HINTS_STORAGE_KEY,
			storage: {
				getItem: (name) => {
					const serialized = localStorage.getItem(name);
					if (!serialized) return null;
					const parsed = JSON.parse(serialized);
					return {
						...parsed,
						state: {
							...parsed.state,
							dismissedHints: new Set(parsed.state.dismissedHints || []),
						},
					};
				},
				setItem: (name, value) => {
					const payload = {
						...value,
						state: {
							...value.state,
							dismissedHints: Array.from(value.state.dismissedHints),
						},
					};
					localStorage.setItem(name, JSON.stringify(payload));
				},
				removeItem: (name) => localStorage.removeItem(name),
			},
		},
	),
);
