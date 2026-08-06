import { githubUsername } from "@/config/profileConfig";
import {
	getBlogActivityCalendar,
	getGithubActivityCalendar,
} from "@/utils/home-activity";

export async function GET() {
	const [blog, github] = await Promise.all([
		getBlogActivityCalendar(),
		getGithubActivityCalendar(githubUsername),
	]);

	return new Response(
		JSON.stringify({
			generatedAt: new Date().toISOString(),
			blog,
			github,
		}),
		{
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache, no-store, must-revalidate",
			},
		},
	);
}
