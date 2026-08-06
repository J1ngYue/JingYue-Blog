import { getBilibiliHot } from "@/utils/bilibili-hot";

// Static builds receive a fresh snapshot; Cloudflare Workers serves this route
// at runtime so the one-hour cache can refresh without rebuilding the site.
export async function GET(): Promise<Response> {
	const items = await getBilibiliHot();

	return new Response(
		JSON.stringify({
			source: "bilibili",
			updatedAt: new Date().toISOString(),
			items,
		}),
		{
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control":
					"public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
			},
		},
	);
}
