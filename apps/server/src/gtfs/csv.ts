const SEPARATOR = ",";
const QUOTE = "\"";

export function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === QUOTE) {
			const next = line[i + 1];
			// handle escaped quotes ""
			if (inQuotes && next === QUOTE) {
				current += QUOTE;
				i++;
				continue;
			}
			inQuotes = !inQuotes;
			continue;
		}

		if (char === SEPARATOR && !inQuotes) {
			values.push(current);
			current = "";
			continue;
		}

		current += char;
	}

	values.push(current);
	return values;
}

export function parseCsv(text: string): string[][] {
	return text
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0)
		.map(parseCsvLine);
}