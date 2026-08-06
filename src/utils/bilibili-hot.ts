export interface BilibiliHotItem {
	keyword: string;
	showName: string;
	position: number;
	wordType: number;
	heatScore: number;
}

const BILIBILI_HOT_ENDPOINT = "https://s.search.bilibili.com/main/hotword";
const BILIBILI_HOT_TTL = 60 * 60 * 1000;

const fallbackItems: BilibiliHotItem[] = [
	{
		keyword: "哔哩哔哩热搜",
		showName: "正在获取 Bilibili 热搜",
		position: 1,
		wordType: 8,
		heatScore: 0,
	},
	{
		keyword: "Bilibili",
		showName: "Bilibili 热搜榜加载中",
		position: 2,
		wordType: 8,
		heatScore: 0,
	},
	{
		keyword: "热门视频",
		showName: "热门视频与话题",
		position: 3,
		wordType: 8,
		heatScore: 0,
	},
	{
		keyword: "哔哩哔哩番剧",
		showName: "哔哩哔哩番剧",
		position: 4,
		wordType: 8,
		heatScore: 0,
	},
	{
		keyword: "哔哩哔哩直播",
		showName: "哔哩哔哩直播",
		position: 5,
		wordType: 8,
		heatScore: 0,
	},
];

let cachedItems: BilibiliHotItem[] | null = null;
let cachedAt = 0;

function normalizeItems(value: unknown): BilibiliHotItem[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item, index) => {
			if (!item || typeof item !== "object") return null;
			const record = item as Record<string, unknown>;
			const keyword =
				typeof record.keyword === "string" ? record.keyword.trim() : "";
			const showName =
				typeof record.show_name === "string"
					? record.show_name.trim()
					: keyword;
			if (!keyword || !showName) return null;
			return {
				keyword,
				showName,
				position:
					typeof record.pos === "number" && record.pos > 0
						? record.pos
						: index + 1,
				wordType: typeof record.word_type === "number" ? record.word_type : 8,
				heatScore:
					typeof record.heat_score === "number" ? record.heat_score : 0,
			};
		})
		.filter((item): item is BilibiliHotItem => item !== null)
		.slice(0, 10);
}

export async function getBilibiliHot(): Promise<BilibiliHotItem[]> {
	const now = Date.now();
	if (cachedItems && now - cachedAt < BILIBILI_HOT_TTL) return cachedItems;

	try {
		const response = await fetch(BILIBILI_HOT_ENDPOINT, {
			headers: {
				Accept: "application/json",
				Referer: "https://www.bilibili.com/",
				"User-Agent": "Mozilla/5.0 JingYue-BilibiliHot/1.0",
			},
			cache: "no-store",
		});
		if (!response.ok)
			throw new Error(`Bilibili hot search failed: ${response.status}`);

		const payload = (await response.json()) as { list?: unknown };
		const items = normalizeItems(payload.list);
		if (items.length === 0)
			throw new Error("Bilibili hot search returned no items");

		cachedItems = items;
		cachedAt = now;
		return items;
	} catch (error) {
		console.warn("Bilibili hot search unavailable", error);
		return cachedItems || fallbackItems;
	}
}

export function getBilibiliHotTag(wordType: number): string {
	if (wordType === 4) return "新";
	if (wordType === 9) return "梗";
	if (wordType === 11) return "话";
	return "热";
}

export function formatBilibiliHeat(score: number): string {
	if (!score) return "Bilibili 热搜";
	if (score >= 10000) return `${(score / 10000).toFixed(1)}万热度`;
	return `${score.toLocaleString("zh-CN")}热度`;
}

export function getBilibiliSearchUrl(keyword: string): string {
	return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
}
