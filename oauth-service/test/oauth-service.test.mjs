import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createProviderHandler, handleServiceIndex } from "../lib/oauth.mjs";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function createResponse() {
	const headers = new Map();
	return {
		statusCode: 200,
		headersSent: false,
		body: "",
		setHeader(name, value) {
			headers.set(name.toLowerCase(), value);
		},
		getHeader(name) {
			return headers.get(name.toLowerCase());
		},
		end(value = "") {
			this.body = value;
			this.headersSent = true;
		},
	};
}

function createRequest(url, cookie = "") {
	return {
		method: "GET",
		url,
		headers: {
			cookie,
			origin: "https://blog.example.com",
		},
	};
}

function createWalineRedirect(
	walineType,
	browserProvider = walineType,
	browserState = "browser-state",
) {
	const siteReturn = new URL("https://blog.example.com/guestbook/");
	siteReturn.searchParams.set("oauth_provider", browserProvider);
	siteReturn.searchParams.set("oauth_state", browserState);
	const walineRedirect = new URL("https://waline.example.com/api/oauth");
	walineRedirect.searchParams.set("type", walineType);
	walineRedirect.searchParams.set("redirect", siteReturn.toString());
	return walineRedirect;
}

async function startProviderLogin(
	provider,
	walineType = provider,
	route = provider,
) {
	const handler = createProviderHandler(provider, walineType);
	const startResponse = createResponse();
	await handler(
		createRequest(
			`/api/${route}?${new URLSearchParams({ redirect: createWalineRedirect(walineType, provider).toString() })}`,
		),
		startResponse,
	);
	assert.equal(startResponse.statusCode, 302);
	return {
		handler,
		route,
		authorizationURL: new URL(startResponse.getHeader("location")),
		cookie: startResponse.getHeader("set-cookie").split(";", 1)[0],
	};
}

async function completeProviderLogin({
	provider,
	route = provider,
	handler,
	authorizationURL,
	cookie,
}) {
	const callbackResponse = createResponse();
	await handler(
		createRequest(
			`/api/${route}?${new URLSearchParams({ code: "provider-code", state: authorizationURL.searchParams.get("state") })}`,
			cookie,
		),
		callbackResponse,
	);
	assert.equal(callbackResponse.statusCode, 302);
	const walineCallback = new URL(callbackResponse.getHeader("location"));
	assert.equal(walineCallback.origin, "https://waline.example.com");
	const ticket = walineCallback.searchParams.get("code");
	assert.ok(ticket?.startsWith("fy1."));

	const ticketResponse = createResponse();
	await handler(
		createRequest(`/api/${route}?${new URLSearchParams({ code: ticket })}`),
		ticketResponse,
	);
	assert.equal(ticketResponse.statusCode, 200);
	return JSON.parse(ticketResponse.body);
}

beforeEach(() => {
	process.env.OAUTH_SERVICE_URL = "https://oauth.example.com/api";
	process.env.SITE_URL = "https://blog.example.com";
	process.env.WALINE_SERVER_URL = "https://waline.example.com";
	process.env.OAUTH_SESSION_SECRET =
		"test-secret-with-at-least-thirty-two-characters";
	process.env.QQ_ID = "qq-client-id";
	process.env.QQ_SECRET = "qq-client-secret";
	process.env.WECHAT_ID = "wechat-client-id";
	process.env.WECHAT_SECRET = "wechat-client-secret";
	process.env.GOOGLE_ID = "google-client-id";
	process.env.GOOGLE_SECRET = "google-client-secret";
	process.env.GITHUB_ID = "github-client-id";
	process.env.GITHUB_SECRET = "github-client-secret";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
});

test("service index only exposes configured providers", () => {
	const response = createResponse();
	handleServiceIndex(createRequest("/api"), response);
	assert.equal(response.statusCode, 200);
	assert.equal(
		response.getHeader("access-control-allow-origin"),
		"https://blog.example.com",
	);
	assert.deepEqual(JSON.parse(response.body).services, [
		{ name: "qq", origin: "graph.qq.com" },
		{ name: "oidc", origin: "open.weixin.qq.com" },
		{ name: "google", origin: "accounts.google.com" },
		{ name: "github", origin: "github.com" },
	]);
});

test("QQ login validates state and returns a Waline-compatible identity ticket", async () => {
	const handler = createProviderHandler("qq");
	const siteReturn = new URL("https://blog.example.com/guestbook/");
	siteReturn.searchParams.set("oauth_provider", "qq");
	siteReturn.searchParams.set("oauth_state", "browser-state");
	const walineRedirect = new URL("https://waline.example.com/api/oauth");
	walineRedirect.searchParams.set("type", "qq");
	walineRedirect.searchParams.set("redirect", siteReturn.toString());

	const startResponse = createResponse();
	await handler(
		createRequest(
			`/api/qq?${new URLSearchParams({ redirect: walineRedirect.toString() })}`,
		),
		startResponse,
	);
	assert.equal(startResponse.statusCode, 302);
	const authorizationURL = new URL(startResponse.getHeader("location"));
	assert.equal(authorizationURL.origin, "https://graph.qq.com");
	assert.equal(
		authorizationURL.searchParams.get("redirect_uri"),
		"https://oauth.example.com/api/qq",
	);
	assert.ok(authorizationURL.searchParams.get("state"));
	const cookie = startResponse.getHeader("set-cookie").split(";", 1)[0];

	globalThis.fetch = async (input) => {
		const url = String(input);
		if (url === "https://graph.qq.com/oauth2.0/token") {
			return Response.json({ access_token: "private-access-token" });
		}
		if (url.startsWith("https://graph.qq.com/oauth2.0/me?")) {
			return Response.json({
				client_id: "qq-client-id",
				openid: "qq-open-id",
				unionid: "qq-union-id",
			});
		}
		if (url.startsWith("https://graph.qq.com/user/get_user_info?")) {
			return Response.json({
				ret: 0,
				nickname: "QQ 用户",
				figureurl_qq_2: "https://q.qlogo.cn/avatar.jpg",
			});
		}
		throw new Error(`Unexpected request: ${url}`);
	};

	const callbackResponse = createResponse();
	await handler(
		createRequest(
			`/api/qq?${new URLSearchParams({ code: "provider-code", state: authorizationURL.searchParams.get("state") })}`,
			cookie,
		),
		callbackResponse,
	);
	assert.equal(callbackResponse.statusCode, 302);
	const callbackURL = new URL(callbackResponse.getHeader("location"));
	assert.equal(callbackURL.origin, "https://waline.example.com");
	assert.ok(callbackURL.searchParams.get("code")?.startsWith("fy1."));

	const ticketResponse = createResponse();
	await handler(
		createRequest(
			`/api/qq?${new URLSearchParams({ code: callbackURL.searchParams.get("code") })}`,
		),
		ticketResponse,
	);
	assert.equal(ticketResponse.statusCode, 200);
	assert.deepEqual(JSON.parse(ticketResponse.body), {
		id: "qq-union-id",
		name: "QQ 用户",
		avatar: "https://q.qlogo.cn/avatar.jpg",
	});
});

test("OAuth start rejects redirects outside the configured Waline server", async () => {
	const response = createResponse();
	await createProviderHandler("qq")(
		createRequest(
			`/api/qq?${new URLSearchParams({ redirect: "https://attacker.example/api/oauth?type=qq" })}`,
		),
		response,
	);
	assert.equal(response.statusCode, 400);
	assert.deepEqual(JSON.parse(response.body), {
		error: "oauth_request_invalid",
	});
});

test("OAuth callback rejects a missing state cookie", async () => {
	const response = createResponse();
	await createProviderHandler("qq")(
		createRequest("/api/qq?code=provider-code&state=fs1.invalid.invalid"),
		response,
	);
	assert.equal(response.statusCode, 400);
	assert.deepEqual(JSON.parse(response.body), {
		error: "oauth_request_invalid",
	});
});

test("WeChat login maps UnionID and profile to Waline", async () => {
	const login = await startProviderLogin("wechat", "oidc", "oidc");
	assert.equal(login.authorizationURL.origin, "https://open.weixin.qq.com");
	assert.equal(
		login.authorizationURL.searchParams.get("redirect_uri"),
		"https://oauth.example.com/api/oidc",
	);
	globalThis.fetch = async (input) => {
		const url = String(input);
		if (url.startsWith("https://api.weixin.qq.com/sns/oauth2/access_token?")) {
			return Response.json({
				access_token: "private-access-token",
				openid: "wechat-open-id",
				unionid: "wechat-union-id",
			});
		}
		if (url.startsWith("https://api.weixin.qq.com/sns/userinfo?")) {
			return Response.json({
				unionid: "wechat-union-id",
				nickname: "微信用户",
				headimgurl: "https://wx.qlogo.cn/avatar.jpg",
			});
		}
		throw new Error(`Unexpected request: ${url}`);
	};
	assert.deepEqual(
		await completeProviderLogin({ provider: "wechat", ...login }),
		{
			id: "wechat-union-id",
			name: "微信用户",
			avatar: "https://wx.qlogo.cn/avatar.jpg",
		},
	);
});

test("Google login maps the stable subject and profile to Waline", async () => {
	const login = await startProviderLogin("google");
	assert.equal(login.authorizationURL.origin, "https://accounts.google.com");
	assert.equal(
		login.authorizationURL.searchParams.get("redirect_uri"),
		"https://oauth.example.com/api/google",
	);
	globalThis.fetch = async (input) => {
		const url = String(input);
		if (url === "https://oauth2.googleapis.com/token") {
			return Response.json({ access_token: "private-access-token" });
		}
		if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
			return Response.json({
				sub: "google-subject",
				name: "Google User",
				email: "user@example.com",
				picture: "https://example.com/google-avatar.jpg",
			});
		}
		throw new Error(`Unexpected request: ${url}`);
	};
	assert.deepEqual(
		await completeProviderLogin({ provider: "google", ...login }),
		{
			id: "google-subject",
			name: "Google User",
			email: "user@example.com",
			avatar: "https://example.com/google-avatar.jpg",
		},
	);
});

test("GitHub login maps the numeric account ID and profile to Waline", async () => {
	const login = await startProviderLogin("github");
	assert.equal(login.authorizationURL.origin, "https://github.com");
	assert.equal(
		login.authorizationURL.searchParams.get("redirect_uri"),
		"https://oauth.example.com/api/github",
	);
	globalThis.fetch = async (input) => {
		const url = String(input);
		if (url === "https://github.com/login/oauth/access_token") {
			return Response.json({ access_token: "private-access-token" });
		}
		if (url === "https://api.github.com/user") {
			return Response.json({
				id: 12345,
				login: "octocat",
				name: "The Octocat",
				email: "octocat@example.com",
				html_url: "https://github.com/octocat",
				avatar_url: "https://github.com/octocat.png",
			});
		}
		throw new Error(`Unexpected request: ${url}`);
	};
	assert.deepEqual(
		await completeProviderLogin({ provider: "github", ...login }),
		{
			id: "12345",
			name: "The Octocat",
			email: "octocat@example.com",
			url: "https://github.com/octocat",
			avatar: "https://github.com/octocat.png",
		},
	);
});
