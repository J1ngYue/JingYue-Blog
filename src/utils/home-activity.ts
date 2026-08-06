import { getCollection } from "astro:content";
import { gitActivityByDate } from "@/config/recordSync";
import { siteConfig } from "@/config/siteConfig";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_PUBLIC_CONTRIBUTIONS_URL =
	"https://github-contributions-api.jogruber.de/v4";

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
	date: string;
	count: number;
	level: ActivityLevel;
	isOutsideRange: boolean;
}

export interface ActivityCalendar {
	days: ActivityDay[];
	total: number;
	available: boolean;
	dataStart: string;
	dataEnd: string;
}

interface CalendarWindow {
	visualStart: string;
	visualEnd: string;
	dataStart: string;
	dataEnd: string;
}

interface GithubContributionDay {
	date: string;
	contributionCount: number;
	contributionLevel: string;
}

interface GithubContributionResponse {
	data?: {
		user?: {
			contributionsCollection?: {
				contributionCalendar?: {
					totalContributions: number;
					weeks: Array<{
						contributionDays: GithubContributionDay[];
					}>;
				};
			};
		};
	};
	errors?: Array<{ message?: string }>;
}

interface PublicGithubContributionResponse {
	contributions?: Array<{
		date: string;
		count: number;
		level: number;
	}>;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: siteConfig.timezone || "Asia/Shanghai",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function toDateKey(date: Date): string {
	const parts = dateFormatter.formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
	return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(dateKey: string, amount: number): string {
	const date = parseDateKey(dateKey);
	date.setUTCDate(date.getUTCDate() + amount);
	return date.toISOString().slice(0, 10);
}

function getCalendarWindow(referenceDate = new Date()): CalendarWindow {
	const dataEnd = toDateKey(referenceDate);
	const dataStart = addDays(dataEnd, -364);
	const currentWeekday = parseDateKey(dataEnd).getUTCDay();
	const currentWeekStart = addDays(dataEnd, -currentWeekday);
	const visualStart = addDays(currentWeekStart, -(52 * 7));
	const visualEnd = addDays(visualStart, 53 * 7 - 1);

	return { visualStart, visualEnd, dataStart, dataEnd };
}

function getLevel(count: number): ActivityLevel {
	if (count <= 0) return 0;
	if (count === 1) return 1;
	if (count === 2) return 2;
	if (count === 3) return 3;
	return 4;
}

function buildCalendar(
	counts: Map<string, number>,
	window: CalendarWindow,
	available = true,
	totalOverride?: number,
): ActivityCalendar {
	const days: ActivityDay[] = [];
	let dateKey = window.visualStart;

	while (dateKey <= window.visualEnd) {
		const count = counts.get(dateKey) ?? 0;
		days.push({
			date: dateKey,
			count,
			level: getLevel(count),
			isOutsideRange: dateKey < window.dataStart || dateKey > window.dataEnd,
		});
		dateKey = addDays(dateKey, 1);
	}

	const total =
		totalOverride ??
		Array.from(counts.entries()).reduce(
			(sum, [date, count]) =>
				date >= window.dataStart && date <= window.dataEnd ? sum + count : sum,
			0,
		);

	return {
		days,
		total,
		available,
		dataStart: window.dataStart,
		dataEnd: window.dataEnd,
	};
}

function recordContentDates(
	counts: Map<string, number>,
	dates: Date[],
	window: CalendarWindow,
): void {
	const uniqueDates = new Set(dates.map(toDateKey));
	for (const dateKey of uniqueDates) {
		if (dateKey < window.dataStart || dateKey > window.dataEnd) continue;
		counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
	}
}

export async function getBlogActivityCalendar(): Promise<ActivityCalendar> {
	const window = getCalendarWindow();
	const counts = new Map<string, number>();
	const [posts, dynamics] = await Promise.all([
		getCollection("posts"),
		getCollection("dynamic"),
	]);

	for (const post of posts) {
		if (post.data.draft === true) continue;
		const dates = [post.data.published];
		if (post.data.updated) dates.push(post.data.updated);
		recordContentDates(counts, dates, window);
	}

	for (const dynamic of dynamics) {
		recordContentDates(counts, [dynamic.data.published], window);
	}

	// Keep the local activity view aligned with the commits that are pushed to
	// GitHub. The generated map is refreshed by the build/dev sync hook.
	for (const [dateKey, commitCount] of Object.entries(gitActivityByDate)) {
		if (
			dateKey < window.dataStart ||
			dateKey > window.dataEnd ||
			!Number.isFinite(commitCount) ||
			commitCount <= 0
		) {
			continue;
		}
		counts.set(dateKey, (counts.get(dateKey) ?? 0) + Math.floor(commitCount));
	}

	return buildCalendar(counts, window);
}

function githubLevelToNumber(level: string): ActivityLevel {
	switch (level) {
		case "FIRST_QUARTILE":
			return 1;
		case "SECOND_QUARTILE":
			return 2;
		case "THIRD_QUARTILE":
			return 3;
		case "FOURTH_QUARTILE":
			return 4;
		default:
			return 0;
	}
}

function getGithubToken(): string {
	return (
		import.meta.env.GITHUB_TOKEN ||
		process.env.GITHUB_TOKEN ||
		""
	).trim();
}

async function getPublicGithubActivityCalendar(
	username: string,
	window: CalendarWindow,
): Promise<ActivityCalendar> {
	const response = await fetch(
		`${GITHUB_PUBLIC_CONTRIBUTIONS_URL}/${encodeURIComponent(username)}?y=last`,
		{ headers: { Accept: "application/json" } },
	);
	if (!response.ok) {
		throw new Error(`Public GitHub contributions returned ${response.status}`);
	}

	const payload = (await response.json()) as PublicGithubContributionResponse;
	if (!Array.isArray(payload.contributions)) {
		throw new Error("Public GitHub contribution data is missing");
	}

	const counts = new Map<string, number>();
	const levels = new Map<string, ActivityLevel>();
	for (const day of payload.contributions) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
		counts.set(day.date, Math.max(0, Number(day.count) || 0));
		levels.set(
			day.date,
			Math.min(4, Math.max(0, Number(day.level) || 0)) as ActivityLevel,
		);
	}

	const calendar = buildCalendar(counts, window, true);
	calendar.days = calendar.days.map((day) => ({
		...day,
		level: levels.get(day.date) ?? day.level,
	}));
	return calendar;
}

export async function getGithubActivityCalendar(
	username: string,
): Promise<ActivityCalendar> {
	const window = getCalendarWindow();
	const token = getGithubToken();

	if (!token) {
		try {
			return await getPublicGithubActivityCalendar(username, window);
		} catch (error) {
			console.warn(
				`[home] Failed to load public GitHub contributions for ${username}:`,
				error,
			);
			return buildCalendar(new Map(), window, false);
		}
	}

	const query = `
		query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
			user(login: $login) {
				contributionsCollection(from: $from, to: $to) {
					contributionCalendar {
						totalContributions
						weeks {
							contributionDays {
								date
								contributionCount
								contributionLevel
							}
						}
					}
				}
			}
		}
	`;

	try {
		const response = await fetch(GITHUB_GRAPHQL_URL, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				variables: {
					login: username,
					from: `${window.dataStart}T00:00:00Z`,
					to: `${window.dataEnd}T23:59:59Z`,
				},
			}),
		});

		if (!response.ok) {
			throw new Error(`GitHub GraphQL returned ${response.status}`);
		}

		const payload = (await response.json()) as GithubContributionResponse;
		const contributionCalendar =
			payload.data?.user?.contributionsCollection?.contributionCalendar;
		if (!contributionCalendar || payload.errors?.length) {
			throw new Error(
				payload.errors?.[0]?.message || "GitHub contribution data is missing",
			);
		}

		const counts = new Map<string, number>();
		const levels = new Map<string, ActivityLevel>();
		for (const week of contributionCalendar.weeks) {
			for (const day of week.contributionDays) {
				counts.set(day.date, day.contributionCount);
				levels.set(day.date, githubLevelToNumber(day.contributionLevel));
			}
		}

		const calendar = buildCalendar(
			counts,
			window,
			true,
			contributionCalendar.totalContributions,
		);
		calendar.days = calendar.days.map((day) => ({
			...day,
			level: levels.get(day.date) ?? day.level,
		}));
		return calendar;
	} catch (error) {
		console.warn(
			`[home] Failed to load GitHub contributions for ${username}:`,
			error,
		);
		return buildCalendar(new Map(), window, false);
	}
}
