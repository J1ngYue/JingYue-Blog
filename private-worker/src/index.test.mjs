import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.ts";

const event = {
	id: "event-1",
	title: "测试纪念日",
	note: "记得庆祝",
	kind: "anniversary",
};

function environment(changes = 1) {
	const queries = [];
	return {
		queries,
		env: {
			ALLOWED_ORIGIN: "https://blog.example.com",
			RESEND_API_KEY: "test-key",
			REMINDER_FROM: "reminder@notify.example.com",
			REMINDER_TO: "owner@example.com",
			DB: {
				prepare(sql) {
					return {
						bind(...args) {
							queries.push({ sql, args });
							return this;
						},
						async all() {
							return { results: [event] };
						},
						async first() {
							return { expires_at: Date.now() + 60_000 };
						},
						async run() {
							return { meta: { changes } };
						},
					};
				},
			},
		},
	};
}

test("next-day reminders send once to the configured address", async (t) => {
	const sent = [];
	t.mock.method(globalThis, "fetch", async (url, init) => {
		sent.push({ url, init });
		return new Response(JSON.stringify({ id: "sent-id" }), { status: 200 });
	});
	const { env } = environment();
	await worker.scheduled({ scheduledTime: Date.UTC(2026, 8, 28, 12) }, env);
	assert.equal(sent.length, 1);
	assert.equal(sent[0].url, "https://api.resend.com/emails");
	assert.equal(
		sent[0].init.headers["Idempotency-Key"],
		"reminder/event-1/2026-09-29",
	);
	assert.deepEqual(JSON.parse(sent[0].init.body).to, ["owner@example.com"]);
	assert.match(JSON.parse(sent[0].init.body).text, /日期：2026-09-29/);

	const alreadySent = environment(0);
	await worker.scheduled(
		{ scheduledTime: Date.UTC(2026, 8, 28, 12) },
		alreadySent.env,
	);
	assert.equal(sent.length, 1);
});

test("failed sends release the reminder for a later retry", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response(null, { status: 429 }),
	);
	t.mock.method(console, "error", () => {});
	const { env, queries } = environment();
	await worker.scheduled({ scheduledTime: Date.UTC(2026, 8, 28, 12) }, env);
	assert.ok(
		queries.some(({ sql }) => sql.startsWith("DELETE FROM reminder_log")),
	);
});

test("test email requires a session and uses only the fixed recipient", async (t) => {
	const sent = [];
	t.mock.method(globalThis, "fetch", async (_url, init) => {
		sent.push(JSON.parse(init.body));
		return new Response(JSON.stringify({ id: "sent-id" }), { status: 200 });
	});
	const { env } = environment();
	const url = "https://private.example.com/reminders/test";
	const headers = { Origin: env.ALLOWED_ORIGIN };
	const unauthorized = await worker.fetch(
		new Request(url, { method: "POST", headers }),
		env,
	);
	assert.equal(unauthorized.status, 401);
	assert.equal(sent.length, 0);

	const authorized = await worker.fetch(
		new Request(url, {
			method: "POST",
			headers: { ...headers, Cookie: `__Host-jy_private=${"a".repeat(64)}` },
		}),
		env,
	);
	assert.equal(authorized.status, 200);
	assert.deepEqual(sent[0].to, ["owner@example.com"]);
	assert.equal(sent[0].subject, "JingYue 日历提醒测试");
	assert.equal(sent.length, 1);
});
