export function formatTime(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	return date.toLocaleTimeString("fi-FI", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatMinutesUntil(timestamp: number): string {
	const now = Date.now() / 1000;
	const diff = Math.round((timestamp - now) / 60);
	if (diff <= 0) return "Nyt";
	if (diff === 1) return "1 min";
	return `${diff} min`;
}
