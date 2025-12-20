import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function useOnlineStatus() {
	const [isOnline, setIsOnline] = useState(navigator.onLine);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	return isOnline;
}

export function OfflineIndicator() {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a2e]">
			<div className="flex flex-col items-center gap-4 text-white/80 text-center px-8">
				<WifiOff className="w-16 h-16 text-red-400" />
				<h1 className="text-2xl font-semibold">you're offline</h1>
				<p className="text-white/60 max-w-sm">
					bussitutka needs an internet connection to show real-time bus
					locations and schedules.
				</p>
				<p className="text-white/40 text-sm">reconnect to continue</p>
			</div>
		</div>
	);
}
