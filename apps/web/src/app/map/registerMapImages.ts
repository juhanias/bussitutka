import type { Map as MaplibreMap } from "maplibre-gl";

export function registerMapImages(map: MaplibreMap) {
	// keep this idempotent to avoid errors on hot reloads/remounts
	if (!map.hasImage("bus-icon")) {
		const size = 28;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("2d canvas context not available");

		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
		// actual color comes from the layer
		ctx.fillStyle = "#ffffff";
		ctx.fill();

		map.addImage(
			"bus-icon",
			{
				width: size,
				height: size,
				data: ctx.getImageData(0, 0, size, size).data,
			},
			{ sdf: true },
		);
	}

	if (!map.hasImage("bus-icon-outline")) {
		const size = 28;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("2d canvas context not available");

		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 2;
		ctx.stroke();

		map.addImage("bus-icon-outline", {
			width: size,
			height: size,
			data: ctx.getImageData(0, 0, size, size).data,
		});
	}

	if (!map.hasImage("bus-icon-arrow")) {
		const arrowSize = 40;
		const arrowCanvas = document.createElement("canvas");
		arrowCanvas.width = arrowSize;
		arrowCanvas.height = arrowSize;
		const arrowCtx = arrowCanvas.getContext("2d");
		if (!arrowCtx) throw new Error("2d canvas context not available");

		const centerX = arrowSize / 2;
		const centerY = arrowSize / 2;
		const radius = 12;
		const notchLength = 7;
		const notchHalfAngle = 0.45;
		const notchTipY = centerY - radius - notchLength;

		arrowCtx.beginPath();
		arrowCtx.arc(
			centerX,
			centerY,
			radius,
			-Math.PI / 2 + notchHalfAngle,
			-Math.PI / 2 - notchHalfAngle + Math.PI * 2,
			false,
		);
		arrowCtx.lineTo(centerX, notchTipY);
		arrowCtx.closePath();
		// actual color comes from the layer
		arrowCtx.fillStyle = "#ffffff";
		arrowCtx.fill();

		map.addImage(
			"bus-icon-arrow",
			{
				width: arrowSize,
				height: arrowSize,
				data: arrowCtx.getImageData(0, 0, arrowSize, arrowSize).data,
			},
			{ sdf: true },
		);
	}

	if (!map.hasImage("bus-icon-arrow-outline")) {
		const arrowSize = 40;
		const arrowCanvas = document.createElement("canvas");
		arrowCanvas.width = arrowSize;
		arrowCanvas.height = arrowSize;
		const arrowCtx = arrowCanvas.getContext("2d");
		if (!arrowCtx) throw new Error("2d canvas context not available");

		const centerX = arrowSize / 2;
		const centerY = arrowSize / 2;
		const radius = 12;
		const notchLength = 7;
		const notchHalfAngle = 0.45;
		const notchTipY = centerY - radius - notchLength;

		arrowCtx.beginPath();
		arrowCtx.arc(
			centerX,
			centerY,
			radius,
			-Math.PI / 2 + notchHalfAngle,
			-Math.PI / 2 - notchHalfAngle + Math.PI * 2,
			false,
		);
		arrowCtx.lineTo(centerX, notchTipY);
		arrowCtx.closePath();
		arrowCtx.strokeStyle = "#ffffff";
		arrowCtx.lineWidth = 2;
		arrowCtx.stroke();

		map.addImage("bus-icon-arrow-outline", {
			width: arrowSize,
			height: arrowSize,
			data: arrowCtx.getImageData(0, 0, arrowSize, arrowSize).data,
		});
	}
}
