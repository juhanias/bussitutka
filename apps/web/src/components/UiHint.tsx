import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useUiHintsStore } from "@/store/uiHints";

type UiHintProps = {
	id: string;
	condition?: boolean;
	onView?: () => void;
	className?: string;
	children: ReactNode;
};

function UiHint({ id, condition = true, onView, className, children }: UiHintProps) {
	const dismissHint = useUiHintsStore((state) => state.dismissHint);
	const isHintDismissed = useUiHintsStore((state) => state.isHintDismissed);
	const shouldShow = condition && !isHintDismissed(id);

	useEffect(() => {
		if (!shouldShow) return;
		onView?.();
	}, [onView, shouldShow]);

	if (!shouldShow) return null;

	return (
		<button
			type="button"
			onClick={() => dismissHint(id)}
			className={cn("w-full", className)}
		>
			{children}
		</button>
	);
}

export default UiHint;
