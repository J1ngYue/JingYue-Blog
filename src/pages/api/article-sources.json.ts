import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { articleSummarySource } from "@/utils/article-summary-source";
import { removeFileExtension } from "@/utils/url-utils";

export const GET: APIRoute = async () => {
	const posts = await getCollection(
		"posts",
		({ data }) => !data.draft && !data.password,
	);
	return Response.json(
		posts.map((post) => ({
			slug: removeFileExtension(post.id),
			...articleSummarySource(post.data.title, post.body || ""),
		})),
	);
};
