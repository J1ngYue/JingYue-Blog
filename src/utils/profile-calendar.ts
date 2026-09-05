const DAY = 86_400_000;

export function profileDateKey(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

interface ProfileEvent {
	name: string;
	date: string;
	days: number;
	progress: number;
}

export function getProfileCountdowns(
	now: Date,
	timeZone: string,
	siteStart: string,
): {
	week: number;
	month: number;
	year: number;
	holiday: ProfileEvent;
	anniversary: ProfileEvent;
} {
	const today = new Date(`${profileDateKey(now, timeZone)}T00:00:00Z`);
	const year = today.getUTCFullYear();
	const lunar = new Intl.DateTimeFormat("en-u-ca-chinese", {
		timeZone: "UTC",
		month: "numeric",
		day: "numeric",
	});
	const occurrences: { name: string; date: number }[] = [];
	// Intl supplies the lunar calendar, including leap months; no fixed holiday dates.
	for (let offset = -370; offset <= 370; offset++) {
		const date = new Date(today.getTime() + offset * DAY);
		const parts = lunar.formatToParts(date);
		const month = parts.find((part) => part.type === "month")?.value;
		const day = parts.find((part) => part.type === "day")?.value;
		const solarKey = date.toISOString().slice(5, 10);
		const lunarName = (
			{ "1-1": "春节", "5-5": "端午节", "8-15": "中秋节" } as Record<
				string,
				string
			>
		)[`${month}-${day}`];
		const solarName = (
			{ "01-01": "元旦", "05-01": "劳动节", "10-01": "国庆节" } as Record<
				string,
				string
			>
		)[solarKey];
		if (lunarName || solarName)
			occurrences.push({ name: lunarName || solarName, date: date.getTime() });
	}
	const nextHoliday = occurrences.find(
		(event) => event.date >= today.getTime(),
	)!;
	const previousHoliday = occurrences
		.filter(
			(event) =>
				event.name === nextHoliday.name && event.date < nextHoliday.date,
		)
		.at(-1);
	const event = (name: string, next: number, previous: number) => ({
		name,
		date: new Date(next).toISOString().slice(0, 10),
		days: Math.max(0, Math.round((next - today.getTime()) / DAY)),
		progress: Math.max(
			0,
			Math.min(100, ((today.getTime() - previous) / (next - previous)) * 100),
		),
	});
	const [, startMonth, startDay] = siteStart.split("-").map(Number);
	let anniversary = Date.UTC(year, startMonth - 1, startDay);
	if (anniversary < today.getTime())
		anniversary = Date.UTC(year + 1, startMonth - 1, startDay);
	return {
		week: today.getUTCDay() === 0 ? 0 : Math.max(0, 6 - today.getUTCDay()),
		month:
			new Date(Date.UTC(year, today.getUTCMonth() + 1, 0)).getUTCDate() -
			today.getUTCDate(),
		year: Math.round((Date.UTC(year, 11, 31) - today.getTime()) / DAY),
		holiday: event(
			nextHoliday.name,
			nextHoliday.date,
			previousHoliday?.date ?? nextHoliday.date - 365 * DAY,
		),
		anniversary: event(
			"建站日",
			anniversary,
			Date.UTC(
				new Date(anniversary).getUTCFullYear() - 1,
				startMonth - 1,
				startDay,
			),
		),
	};
}
