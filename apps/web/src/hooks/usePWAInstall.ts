import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// capture the event globally before React mounts, as it may fire early
let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
	});
}

export function usePWAInstall() {
	const [installPrompt, setInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(deferredPrompt);
	const [isInstalled, setIsInstalled] = useState(false);

	useEffect(() => {
		// check if already installed (standalone mode)
		const isStandalone =
			window.matchMedia("(display-mode: standalone)").matches ||
			(
				window.navigator as unknown as {
					standalone?: boolean;
				}
			).standalone === true; // iOS Safari

		if (isStandalone) {
			setIsInstalled(true);
			return;
		}

		// sync with global captured event
		if (deferredPrompt && !installPrompt) {
			setInstallPrompt(deferredPrompt);
		}

		const handleBeforeInstall = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			setInstallPrompt(deferredPrompt);
		};

		const handleAppInstalled = () => {
			setIsInstalled(true);
			setInstallPrompt(null);
			deferredPrompt = null;
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstall);
		window.addEventListener("appinstalled", handleAppInstalled);

		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, [installPrompt]);

	const install = async () => {
		if (!installPrompt) return false;

		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;

		if (outcome === "accepted") {
			setInstallPrompt(null);
			return true;
		}
		return false;
	};

	return {
		canInstall: !!installPrompt && !isInstalled,
		isInstalled,
		install,
	};
}
