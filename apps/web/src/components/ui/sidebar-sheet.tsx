import { cn } from "@/lib/utils";

interface SidebarSheetProps {
	open: boolean;
	side?: "left" | "right";
	className?: string;
	children: React.ReactNode;
}

// simple sheet component without radix overhead
// doesn't trap focus or intercept pointer events, so map interaction stays smooth
export function SidebarSheet({
	open,
	side = "left",
	className,
	children,
}: SidebarSheetProps) {
	return (
		<div
			className={cn(
				"fixed z-50 flex flex-col shadow-lg",
				"transition-all duration-300 ease-out",
				side === "left" && "inset-y-0 left-0",
				side === "right" && "inset-y-0 right-0",
				open
					? "translate-x-0 opacity-100"
					: side === "left"
						? "-translate-x-full opacity-0"
						: "translate-x-full opacity-0",
				className,
			)}
		>
			{children}
		</div>
	);
}
