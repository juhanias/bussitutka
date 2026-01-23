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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
			<div className="flex flex-col items-center gap-4 text-foreground/80 text-center px-8">
				<WifiOff className="w-16 h-16 text-destructive" />
				<h1 className="text-2xl font-semibold">Et ole verkkoyhteydessä</h1>
				<p className="text-muted-foreground max-w-sm">
					Bussitutka tarvitsee internet-yhteyden näyttääksesi reaaliaikaiset bussien
					sijainnit ja aikataulut.
				</p>
				<p className="text-muted-foreground/60 text-sm">Yhdistä uudelleen jatkaaksesi</p>
			</div>
		</div>
	);
}
