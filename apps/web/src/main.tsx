import { registerSW } from "virtual:pwa-register";
import { NuqsAdapter } from "nuqs/adapters/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

function syncViewportHeightVar() {
	// android PWAs can report vh/dvh bigger than the visible area due to system UI.
	// using visualViewport keeps absolute overlays (ui) in-view.
	const height =
		typeof window !== "undefined" && window.visualViewport
			? window.visualViewport.height
			: typeof window !== "undefined"
				? window.innerHeight
				: null;

	if (!height) return;
	document.documentElement.style.setProperty(
		"--viewport-height",
		`${height}px`,
	);
}

// register service worker with auto-update
registerSW({ immediate: true });

syncViewportHeightVar();

if (typeof window !== "undefined") {
	window.addEventListener("resize", syncViewportHeightVar);
	window.visualViewport?.addEventListener("resize", syncViewportHeightVar);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
	<StrictMode>
		<NuqsAdapter>
			<App />
		</NuqsAdapter>
	</StrictMode>,
);
