import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityCalendar } from "./home-activity";
import { getGithubMonthDays, getGithubYearWindow } from "./profile-github";

const calendar: ActivityCalendar = {
	available: true,
	total: 12,
	dataStart: "2026-01-01",
	dataEnd: "2026-10-03",
	days: [{ date: "2026-10-02", count: 12, level: 4, isOutsideRange: false }],
};

test("month grids adapt to 28, 29, 30 and 31 days without weekday spacers", () => {
	for (const [date, length] of [
		["2026-02-01", 28],
		["2028-02-01", 29],
		["2026-04-01", 30],
		["2026-10-03", 31],
	] as const) {
		const days = getGithubMonthDays(calendar, date);
		assert.equal(days.length, length);
		assert.equal(days[0].date, `${date.slice(0, 7)}-01`);
		assert.equal(days.at(-1)?.date, `${date.slice(0, 7)}-${length}`);
	}
});

test("month view preserves real contribution levels and marks missing dates", () => {
	const days = getGithubMonthDays(calendar, "2026-10-03");
	assert.deepEqual(days[1], calendar.days[0]);
	assert.equal(days[3].isOutsideRange, true);
	assert.equal(days[3].count, 0);
});

test("year view covers January to December, aligned to Sunday and Saturday", () => {
	for (const year of [2025, 2026, 2028]) {
		const window = getGithubYearWindow(year, "2029-10-03");
		assert.equal(window.dataStart, `${year}-01-01`);
		assert.equal(window.dataEnd, `${year}-12-31`);
		assert.equal(new Date(window.visualStart).getUTCDay(), 0);
		assert.equal(new Date(window.visualEnd).getUTCDay(), 6);
		assert.ok(window.visualStart <= window.dataStart);
		assert.ok(window.visualEnd >= window.dataEnd);
	}
});

test("current year has no fabricated future contributions", () => {
	assert.equal(getGithubYearWindow(2026, "2026-10-03").dataEnd, "2026-10-03");
});
