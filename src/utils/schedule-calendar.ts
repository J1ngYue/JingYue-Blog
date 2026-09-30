export interface ScheduleRecord {
	id: string;
	date: string;
	title: string;
	note: string;
	kind: string;
	recurring: number;
}

const lunarFormatter = new Intl.DateTimeFormat("en-u-ca-chinese", {
	month: "numeric",
	day: "numeric",
});
const lunarMonths = [
	"正",
	"二",
	"三",
	"四",
	"五",
	"六",
	"七",
	"八",
	"九",
	"十",
	"冬",
	"腊",
];
const numerals = [
	"",
	"一",
	"二",
	"三",
	"四",
	"五",
	"六",
	"七",
	"八",
	"九",
	"十",
];

export function calendarDateInfo(date: Date): {
	lunarDay: string;
	lunarDate: string;
	holiday: string;
} {
	const parts = lunarFormatter.formatToParts(date);
	const monthPart = parts.find((part) => part.type === "month")?.value ?? "";
	const month = Number.parseInt(monthPart, 10);
	const day = Number(parts.find((part) => part.type === "day")?.value);
	const lunarDay =
		day <= 10
			? `初${numerals[day]}`
			: day < 20
				? `十${numerals[day - 10]}`
				: day === 20
					? "二十"
					: day < 30
						? `廿${numerals[day - 20]}`
						: "三十";
	const solarHoliday = (
		{ "1-1": "元旦", "5-1": "劳动节", "10-1": "国庆节" } as Record<
			string,
			string
		>
	)[`${date.getMonth() + 1}-${date.getDate()}`];
	const lunarHoliday = !monthPart.includes("bis")
		? (
				{ "1-1": "春节", "5-5": "端午节", "8-15": "中秋节" } as Record<
					string,
					string
				>
			)[`${month}-${day}`]
		: "";
	return {
		lunarDay,
		lunarDate: `${monthPart.includes("bis") ? "闰" : ""}${lunarMonths[month - 1]}月${lunarDay}`,
		holiday: solarHoliday || lunarHoliday || "",
	};
}

export function nextScheduleDate(
	event: ScheduleRecord,
	today: Date,
): Date | null {
	const [year, month, day] = event.date.split("-").map(Number);
	const start = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate(),
	);
	if (!event.recurring) {
		const date = new Date(year, month - 1, day);
		return date >= start ? date : null;
	}
	// A leap-day birthday only occurs on a real February 29, never March 1.
	for (
		let nextYear = Math.max(year, start.getFullYear());
		nextYear <= Math.max(year, start.getFullYear()) + 4;
		nextYear++
	) {
		const date = new Date(nextYear, month - 1, day);
		if (
			date.getMonth() === month - 1 &&
			date.getDate() === day &&
			date >= start
		)
			return date;
	}
	return null;
}

export function upcomingPublicHolidays(today: Date): ScheduleRecord[] {
	const events: ScheduleRecord[] = [];
	for (let offset = 0; offset <= 370 && events.length < 2; offset++) {
		const date = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate() + offset,
		);
		const holiday = calendarDateInfo(date).holiday;
		if (!holiday) continue;
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		events.push({
			id: `public-${key}`,
			date: key,
			title: holiday,
			note: "节日当天（不代表放假或调休安排）",
			kind: "holiday",
			recurring: 0,
		});
	}
	return events;
}
