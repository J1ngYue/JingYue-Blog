import assert from "node:assert/strict";
import test from "node:test";
import {
	calendarDateInfo,
	nextScheduleDate,
	upcomingPublicHolidays,
} from "./schedule-calendar";

const event = {
	id: "test",
	date: "2020-10-01",
	title: "测试日子",
	note: "",
	kind: "birthday",
	recurring: 1,
};

test("lunar labels and festivals come from real calendar dates", () => {
	assert.deepEqual(calendarDateInfo(new Date(2026, 8, 25)), {
		lunarDay: "十五",
		lunarDate: "八月十五",
		holiday: "中秋节",
	});
	assert.equal(calendarDateInfo(new Date(2026, 9, 1)).holiday, "国庆节");
	assert.equal(calendarDateInfo(new Date(2026, 8, 30)).lunarDay, "二十");
});

test("upcoming holidays do not include past holidays", () => {
	assert.deepEqual(
		upcomingPublicHolidays(new Date(2026, 8, 30)).map((item) => [
			item.title,
			item.date,
		]),
		[
			["国庆节", "2026-10-01"],
			["元旦", "2027-01-01"],
		],
	);
});

test("recurring events roll over after the day, not during it", () => {
	assert.equal(
		nextScheduleDate(event, new Date(2026, 9, 1, 22))?.getFullYear(),
		2026,
	);
	assert.equal(
		nextScheduleDate(event, new Date(2026, 9, 2))?.getFullYear(),
		2027,
	);
	assert.equal(
		nextScheduleDate({ ...event, recurring: 0 }, new Date(2026, 9, 1)),
		null,
	);
});

test("leap-day events do not silently move to March", () => {
	const date = nextScheduleDate(
		{ ...event, date: "2020-02-29" },
		new Date(2026, 0, 1),
	);
	assert.equal(date?.getFullYear(), 2028);
	assert.equal(date?.getMonth(), 1);
	assert.equal(date?.getDate(), 29);
});
