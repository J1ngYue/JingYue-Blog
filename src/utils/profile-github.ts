import type { ActivityCalendar, ActivityDay } from "./home-activity";

export function getGithubYearWindow(
	year: number,
	today: string,
): {
	visualStart: string;
	visualEnd: string;
	dataStart: string;
	dataEnd: string;
} {
	const dataStart = `${year}-01-01`;
	const yearEnd = `${year}-12-31`;
	const start = new Date(`${dataStart}T00:00:00Z`);
	const end = new Date(`${yearEnd}T00:00:00Z`);
	start.setUTCDate(start.getUTCDate() - start.getUTCDay());
	end.setUTCDate(end.getUTCDate() + 6 - end.getUTCDay());
	return {
		visualStart: start.toISOString().slice(0, 10),
		visualEnd: end.toISOString().slice(0, 10),
		dataStart,
		dataEnd: today < yearEnd ? today : yearEnd,
	};
}

export function getGithubMonthDays(
	calendar: ActivityCalendar,
	today: string,
): ActivityDay[] {
	const month = today.slice(0, 7);
	const byDate = new Map(calendar.days.map((day) => [day.date, day]));
	const length = new Date(
		Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
	).getUTCDate();
	return Array.from({ length }, (_, index) => {
		const date = `${month}-${String(index + 1).padStart(2, "0")}`;
		return (
			byDate.get(date) ?? { date, count: 0, level: 0, isOutsideRange: true }
		);
	});
}
