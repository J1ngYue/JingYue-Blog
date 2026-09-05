import assert from "node:assert/strict";
import test from "node:test";
import { getProfileCountdowns, profileDateKey } from "./profile-calendar";

const calendar = (date: string) =>
	getProfileCountdowns(new Date(date), "Asia/Shanghai", "2025-01-01");

test("uses the site's timezone at midnight", () => {
	assert.equal(
		profileDateKey(new Date("2026-09-05T16:00:00Z"), "Asia/Shanghai"),
		"2026-09-06",
	);
});

test("matches the reference countdowns using real lunar dates", () => {
	const result = calendar("2026-09-06T00:00:00Z");
	assert.equal(result.week, 0);
	assert.equal(result.month, 24);
	assert.equal(result.year, 116);
	assert.equal(result.holiday.name, "中秋节");
	assert.equal(result.holiday.date, "2026-09-25");
	assert.equal(result.holiday.days, 19);
	assert.equal(result.anniversary.date, "2027-01-01");
	assert.equal(result.anniversary.days, 117);
});

test("holiday day reaches 100 percent, then advances", () => {
	assert.equal(calendar("2026-09-25T00:00:00Z").holiday.days, 0);
	assert.equal(calendar("2026-09-25T00:00:00Z").holiday.progress, 100);
	assert.equal(calendar("2026-09-26T00:00:00Z").holiday.name, "国庆节");
});

test("handles leap years, year end and anniversary rollover", () => {
	assert.equal(calendar("2028-02-28T00:00:00Z").month, 1);
	assert.equal(calendar("2026-12-31T00:00:00Z").year, 0);
	assert.equal(calendar("2027-01-01T00:00:00Z").anniversary.progress, 100);
	assert.equal(calendar("2027-01-02T00:00:00Z").anniversary.date, "2028-01-01");
});

test("weekend is zero on both Saturday and Sunday", () => {
	assert.equal(calendar("2026-09-04T00:00:00Z").week, 1);
	assert.equal(calendar("2026-09-05T00:00:00Z").week, 0);
	assert.equal(calendar("2026-09-06T00:00:00Z").week, 0);
	assert.equal(calendar("2026-09-07T00:00:00Z").week, 5);
});
