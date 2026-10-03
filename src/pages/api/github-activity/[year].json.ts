import type { APIRoute, GetStaticPaths } from "astro";
import { githubUsername } from "@/config/profileConfig";
import {
	getGithubActivityCalendar,
	getGithubContributionYears,
} from "@/utils/home-activity";

export const prerender = true;
export const getStaticPaths: GetStaticPaths = async () =>
	(await getGithubContributionYears(githubUsername)).map((year) => ({
		params: { year: String(year) },
	}));

export const GET: APIRoute = async ({ params }) =>
	new Response(
		JSON.stringify(
			await getGithubActivityCalendar(githubUsername, Number(params.year)),
		),
		{
			headers: { "Content-Type": "application/json; charset=utf-8" },
		},
	);
