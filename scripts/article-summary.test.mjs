import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { articleSummary } from "../private-worker/src/article-summary.ts";
import { articleSummarySource } from "../src/utils/article-summary-source.ts";

const database = new DatabaseSync(":memory:");
database.exec(await readFile(new URL("../private-worker/migrations/0002_article_summaries.sql", import.meta.url), "utf8"));
const env = {
	ALLOWED_ORIGIN: "https://blog.j1ngyue.cn",
	DEEPSEEK_API_KEY: "test-only-server-key",
	DB: {
		prepare(sql) {
			const statement = database.prepare(sql);
			let values = [];
			return {
				bind(...args) { values = args; return this; },
				async first() { return statement.get(...values) || null; },
				async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
			};
		},
	},
};
const articles = ["example", "failure", "parallel", "incomplete"].map((slug) => ({
	slug,
	...articleSummarySource(slug, "这是公开的文章正文。"),
}));
const originalFetch = globalThis.fetch;
let aiCalls = 0;
let holdGeneration;
let failure = false;
let incomplete = false;
globalThis.fetch = async (input, options) => {
	if (input === "https://jing-yue-blog.vercel.app/api/article-sources.json") return Response.json(articles);
	assert.equal(input, "https://api.deepseek.com/chat/completions");
	aiCalls++;
	assert.equal(options.headers.Authorization, "Bearer test-only-server-key");
	const payload = JSON.parse(options.body);
	assert.equal(payload.model, "deepseek-flash");
	assert.deepEqual(payload.thinking, { type: "disabled" });
	assert.equal(payload.max_tokens, 600);
	if (holdGeneration) await new Promise((resolve) => { holdGeneration = resolve; });
	if (failure) return new Response(null, { status: 503 });
	return Response.json({ choices: [{ finish_reason: incomplete ? "length" : "stop", message: { content: "文章介绍公开资料的核心内容，帮助读者了解主题与实践方法。" } }] });
};
const request = (slug, origin = env.ALLOWED_ORIGIN, method = "GET", version = articles.find((post) => post.slug === slug)?.version || "missing") => new Request(
	`https://private.j1ngyue.cn/article-summary?slug=${slug}&version=${version}`,
	{ method, headers: { Origin: origin } },
);

try {
	assert.equal((await articleSummary(request("example", "https://unrelated.example"), env)).status, 403);
	assert.equal((await articleSummary(request("example", env.ALLOWED_ORIGIN, "POST"), env)).status, 405);
	assert.equal((await articleSummary(request("not-public"), env)).status, 404);
	assert.equal((await articleSummary(request("example", env.ALLOWED_ORIGIN, "GET", "outdated"), env)).status, 409);
	assert.equal(aiCalls, 0);
	const first = await articleSummary(request("example"), env);
	assert.equal(first.status, 200);
	assert.equal(first.headers.get("Access-Control-Allow-Credentials"), null);
	assert.equal((await first.json()).cached, false);
	const cached = await articleSummary(request("example", "https://jing-yue-blog.vercel.app"), env);
	assert.equal((await cached.json()).cached, true);
	assert.equal(aiCalls, 1);

	holdGeneration = true;
	const parallel = articleSummary(request("parallel"), env);
	while (typeof holdGeneration !== "function") await new Promise((resolve) => setImmediate(resolve));
	assert.equal((await articleSummary(request("parallel"), env)).status, 202);
	assert.equal(aiCalls, 2);
	holdGeneration();
	holdGeneration = undefined;
	assert.equal((await parallel).status, 200);

	failure = true;
	assert.equal((await articleSummary(request("failure"), env)).status, 503);
	assert.equal((await articleSummary(request("failure"), env)).status, 202);
	assert.equal(aiCalls, 3);
	for (let attempt = 0; attempt < 2; attempt++) {
		database.prepare("UPDATE article_summaries SET locked_until=0 WHERE version=?").run(articles[1].version);
		assert.equal((await articleSummary(request("failure"), env)).status, 503);
	}
	assert.equal((await articleSummary(request("failure"), env)).status, 503);
	assert.equal(aiCalls, 5);
	failure = false;
	incomplete = true;
	assert.equal((await articleSummary(request("incomplete"), env)).status, 503);
	assert.equal(database.prepare("SELECT summary FROM article_summaries WHERE version=?").get(articles[3].version).summary, "");
	const long = articleSummarySource("长文章", "a".repeat(30_000));
	assert.ok(long.text.length < 18_100);
	assert.ok(long.text.includes("[中间内容省略]"));
	assert.notEqual(long.version, articleSummarySource("长文章", "a".repeat(30_001)).version);
	console.log("Article summary checks passed: allowlist, versions, private CORS isolation, caching, concurrent lock, cooldown, bounded retries, incomplete output and content limits.");
} finally {
	globalThis.fetch = originalFetch;
	database.close();
}
