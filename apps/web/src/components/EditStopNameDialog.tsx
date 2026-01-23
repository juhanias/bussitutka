import { useEffect, useState } from "react";
import { useCustomStopNamesStore } from "../store/customStopNames";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";

type EditStopNameDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	stopCode: string;
	originalName: string;
};

export function EditStopNameDialog({
	open,
	onOpenChange,
	stopCode,
	originalName,
}: EditStopNameDialogProps) {
	const { customNames, setCustomName, resetCustomName } =
		useCustomStopNamesStore();
	const [inputValue, setInputValue] = useState("");

	useEffect(() => {
		if (open) {
			setInputValue(customNames.get(stopCode) || originalName);
		}
	}, [open, stopCode, originalName, customNames]);

	const handleSave = () => {
		if (inputValue !== originalName) {
			setCustomName(stopCode, inputValue);
		} else {
			resetCustomName(stopCode);
		}
		onOpenChange(false);
	};

	const handleReset = () => {
		resetCustomName(stopCode);
		setInputValue(originalName);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Muokkaa pysäkin lempinimeä</DialogTitle>
					<DialogDescription>Pysäkin koodi: {stopCode}</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<input
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder={originalName}
						className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
					/>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleSave}
							className="flex-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
						>
							Tallenna
						</button>
						<button
							type="button"
							onClick={handleReset}
							className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
						>
							Palauta
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
