import { getKnowledgeGraphData } from "@/utils/content-utils";

export async function GET(): Promise<Response> {
	const graph = await getKnowledgeGraphData();
	return new Response(JSON.stringify(graph), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
		},
	});
}
