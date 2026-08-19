import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

const SERVICE_VERSION = "1.0.0";
const FLOW_TTL_SECONDS = 10 * 60;
const TICKET_TTL_SECONDS = 5 * 60;
const REQUEST_TIMEOUT_MS = 10_000;
const PROVIDERS = ["qq", "wechat", "google", "github"];
const WALINE_SERVICES = [
	{ name: "qq", provider: "qq" },
	{ name: "oidc", provider: "wechat" },
	{ name: "google", provider: "google" },
	{ name: "github", provider: "github" },
];

const providerConfig = {
	qq: {
		idEnv: "QQ_ID",
		secretEnv: "QQ_SECRET",
		origin: "graph.qq.com",
	},
	wechat: {
		idEnv: "WECHAT_ID",
		secretEnv: "WECHAT_SECRET",
		origin: "open.weixin.qq.com",
		callbackRoute: "oidc",
	},
	google: {
		idEnv: "GOOGLE_ID",
		secretEnv: "GOOGLE_SECRET",
		origin: "accounts.google.com",
	},
	github: {
		idEnv: "GITHUB_ID",
		secretEnv: "GITHUB_SECRET",
		origin: "github.com",
	},
};

function getEnv(name) {
	return process.env[name]?.trim() || "";
}

function getProviderCredentials(provider) {
	const config = providerConfig[provider];
	return {
		id: getEnv(config.idEnv),
		secret: getEnv(config.secretEnv),
	};
}

function isProviderConfigured(provider) {
	const { id, secret } = getProviderCredentials(provider);
	return Boolean(id && secret);
}

function getServiceBaseURL() {
	const value = getEnv("OAUTH_SERVICE_URL");
	if (!value) throw new Error("OAUTH_SERVICE_URL is not configured");
	const url = new URL(value);
	const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
		throw new Error("OAUTH_SERVICE_URL must use HTTPS");
	}
	url.pathname = url.pathname.replace(/\/+$/u, "");
	url.search = "";
	url.hash = "";
	return url;
}

function getCallbackURL(provider) {
	const baseURL = getServiceBaseURL();
	baseURL.pathname = `${baseURL.pathname}/${providerConfig[provider].callbackRoute || provider}`;
	return baseURL.toString();
}

function getSessionSecret() {
	const secret = getEnv("OAUTH_SESSION_SECRET");
	if (secret.length < 32) {
		throw new Error("OAUTH_SESSION_SECRET must contain at least 32 characters");
	}
	return secret;
}

function deriveKey(purpose) {
	return createHash("sha256")
		.update(`${purpose}:${getSessionSecret()}`)
		.digest();
}

function seal(value, purpose) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", deriveKey(purpose), iv);
	cipher.setAAD(Buffer.from(purpose));
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(value), "utf8"),
		cipher.final(),
	]);
	return [
		"fy1",
		iv.toString("base64url"),
		encrypted.toString("base64url"),
		cipher.getAuthTag().toString("base64url"),
	].join(".");
}

function unseal(token, purpose) {
	const [version, ivValue, encryptedValue, tagValue] = token.split(".");
	if (version !== "fy1" || !ivValue || !encryptedValue || !tagValue) {
		throw new Error("Invalid encrypted payload");
	}
	const decipher = createDecipheriv(
		"aes-256-gcm",
		deriveKey(purpose),
		Buffer.from(ivValue, "base64url"),
	);
	decipher.setAAD(Buffer.from(purpose));
	decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(encryptedValue, "base64url")),
		decipher.final(),
	]);
	return JSON.parse(decrypted.toString("utf8"));
}

function createState(provider, nonce) {
	const signature = createHmac("sha256", deriveKey("oauth-state"))
		.update(`${provider}:${nonce}`)
		.digest("base64url");
	return `fs1.${nonce}.${signature}`;
}

function verifyState(provider, state) {
	const [version, nonce, receivedSignature] = String(state || "").split(".");
	if (version !== "fs1" || !nonce || !receivedSignature) return null;
	const expectedSignature = createHmac("sha256", deriveKey("oauth-state"))
		.update(`${provider}:${nonce}`)
		.digest("base64url");
	const received = Buffer.from(receivedSignature);
	const expected = Buffer.from(expectedSignature);
	if (
		received.length !== expected.length ||
		!timingSafeEqual(received, expected)
	) {
		return null;
	}
	return nonce;
}

function parseCookies(request) {
	const cookies = {};
	for (const entry of String(request.headers.cookie || "").split(";")) {
		const separator = entry.indexOf("=");
		if (separator < 0) continue;
		const key = entry.slice(0, separator).trim();
		const value = entry.slice(separator + 1).trim();
		if (key) cookies[key] = value;
	}
	return cookies;
}

function getCookieName(provider) {
	return `firefly_oauth_${provider}`;
}

function createFlowCookie(provider, value, maxAge) {
	const callbackURL = new URL(getCallbackURL(provider));
	const secure = callbackURL.protocol === "https:" ? "; Secure" : "";
	return `${getCookieName(provider)}=${value}; Path=${callbackURL.pathname}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function setSecurityHeaders(response) {
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("Pragma", "no-cache");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", "DENY");
}

function getSiteOrigin() {
	const value = getEnv("SITE_URL");
	if (!value) throw new Error("SITE_URL is not configured");
	return new URL(value).origin;
}

function setCorsHeader(request, response) {
	const requestOrigin = request.headers.origin;
	if (!requestOrigin) return;
	const originURL = new URL(requestOrigin);
	const isLocalDevelopment =
		(originURL.hostname === "localhost" ||
			originURL.hostname === "127.0.0.1") &&
		originURL.protocol === "http:";
	if (requestOrigin === getSiteOrigin() || isLocalDevelopment) {
		response.setHeader("Access-Control-Allow-Origin", requestOrigin);
		response.setHeader("Vary", "Origin");
	}
}

function sendJSON(response, status, body) {
	response.statusCode = status;
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	response.end(JSON.stringify(body));
}

function sendRedirect(response, location, cookie) {
	response.statusCode = 302;
	response.setHeader("Location", location);
	if (cookie) response.setHeader("Set-Cookie", cookie);
	response.end();
}

function normalizePathname(pathname) {
	return pathname.replace(/\/+$/u, "") || "/";
}

function validateWalineRedirect(value, walineType) {
	if (!value) throw new Error("Missing Waline redirect");
	const actual = new URL(value);
	const walineBase = new URL(getEnv("WALINE_SERVER_URL"));
	const expectedPath = `${normalizePathname(walineBase.pathname) === "/" ? "" : normalizePathname(walineBase.pathname)}/api/oauth`;
	if (
		actual.origin !== walineBase.origin ||
		normalizePathname(actual.pathname) !== expectedPath ||
		actual.searchParams.get("type") !== walineType
	) {
		throw new Error("Waline redirect is not allowed");
	}

	const siteReturnValue = actual.searchParams.get("redirect");
	if (!siteReturnValue || new URL(siteReturnValue).origin !== getSiteOrigin()) {
		throw new Error("Site return URL is not allowed");
	}
	return actual.toString();
}

function getSiteReturnURL(walineRedirect) {
	const returnValue = new URL(walineRedirect).searchParams.get("redirect");
	const returnURL = new URL(returnValue);
	if (returnURL.origin !== getSiteOrigin()) {
		throw new Error("Site return URL is not allowed");
	}
	return returnURL;
}

function redirectOAuthError(response, flow, code) {
	const returnURL = getSiteReturnURL(flow.walineRedirect);
	returnURL.searchParams.set("oauth_error", code);
	returnURL.searchParams.set("oauth_provider", flow.provider);
	sendRedirect(
		response,
		returnURL.toString(),
		createFlowCookie(flow.provider, "", 0),
	);
}

async function fetchResponse(url, options = {}) {
	const response = await fetch(url, {
		...options,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error("OAuth provider request failed");
	return response;
}

async function fetchJSON(url, options = {}) {
	const response = await fetchResponse(url, options);
	try {
		return await response.json();
	} catch {
		throw new Error("OAuth provider returned invalid JSON");
	}
}

function requireAccessToken(payload) {
	if (!payload || typeof payload.access_token !== "string") {
		throw new Error("OAuth provider did not return an access token");
	}
	return payload.access_token;
}

function buildAuthorizationURL(provider, state) {
	const { id } = getProviderCredentials(provider);
	const callbackURL = getCallbackURL(provider);

	if (provider === "qq") {
		const url = new URL("https://graph.qq.com/oauth2.0/authorize");
		url.search = new URLSearchParams({
			response_type: "code",
			client_id: id,
			redirect_uri: callbackURL,
			state,
			scope: "get_user_info",
		}).toString();
		return url.toString();
	}

	if (provider === "wechat") {
		const url = new URL("https://open.weixin.qq.com/connect/qrconnect");
		url.search = new URLSearchParams({
			appid: id,
			redirect_uri: callbackURL,
			response_type: "code",
			scope: "snsapi_login",
			state,
		}).toString();
		url.hash = "wechat_redirect";
		return url.toString();
	}

	if (provider === "google") {
		const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		url.search = new URLSearchParams({
			client_id: id,
			redirect_uri: callbackURL,
			response_type: "code",
			scope: "openid email profile",
			state,
			prompt: "select_account",
		}).toString();
		return url.toString();
	}

	const url = new URL("https://github.com/login/oauth/authorize");
	url.search = new URLSearchParams({
		client_id: id,
		redirect_uri: callbackURL,
		scope: "read:user user:email",
		state,
	}).toString();
	return url.toString();
}

async function getQQProfile(code) {
	const { id, secret } = getProviderCredentials("qq");
	const token = await fetchJSON("https://graph.qq.com/oauth2.0/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: id,
			client_secret: secret,
			code,
			redirect_uri: getCallbackURL("qq"),
			fmt: "json",
		}),
	});
	const accessToken = requireAccessToken(token);
	const identity = await fetchJSON(
		`https://graph.qq.com/oauth2.0/me?${new URLSearchParams({ access_token: accessToken, unionid: "1", fmt: "json" })}`,
	);
	if (!identity.openid) throw new Error("QQ did not return OpenID");
	const user = await fetchJSON(
		`https://graph.qq.com/user/get_user_info?${new URLSearchParams({ oauth_consumer_key: id, access_token: accessToken, openid: identity.openid, format: "json" })}`,
	);
	if (Number(user.ret) !== 0) throw new Error("QQ user profile request failed");
	return {
		id: String(identity.unionid || identity.openid),
		name: String(user.nickname || "QQ 用户"),
		email: undefined,
		url: undefined,
		avatar:
			user.figureurl_qq_2 ||
			user.figureurl_qq_1 ||
			user.figureurl_qq ||
			user.figureurl_2 ||
			user.figureurl_1 ||
			user.figureurl,
	};
}

async function getWechatProfile(code) {
	const { id, secret } = getProviderCredentials("wechat");
	const token = await fetchJSON(
		`https://api.weixin.qq.com/sns/oauth2/access_token?${new URLSearchParams({ appid: id, secret, code, grant_type: "authorization_code" })}`,
	);
	const accessToken = requireAccessToken(token);
	if (!token.openid) throw new Error("WeChat did not return OpenID");
	const user = await fetchJSON(
		`https://api.weixin.qq.com/sns/userinfo?${new URLSearchParams({ access_token: accessToken, openid: token.openid, lang: "zh_CN" })}`,
	);
	if (user.errcode) throw new Error("WeChat user profile request failed");
	return {
		id: String(user.unionid || token.unionid || token.openid),
		name: String(user.nickname || "微信用户"),
		email: undefined,
		url: undefined,
		avatar: user.headimgurl,
	};
}

async function getGoogleProfile(code) {
	const { id, secret } = getProviderCredentials("google");
	const token = await fetchJSON("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: id,
			client_secret: secret,
			redirect_uri: getCallbackURL("google"),
			grant_type: "authorization_code",
		}),
	});
	const accessToken = requireAccessToken(token);
	const user = await fetchJSON(
		"https://openidconnect.googleapis.com/v1/userinfo",
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);
	if (!user.sub) throw new Error("Google did not return a stable user ID");
	return {
		id: String(user.sub),
		name: String(user.name || user.email || "Google 用户"),
		email: user.email,
		url: undefined,
		avatar: user.picture,
	};
}

async function getGithubProfile(code) {
	const { id, secret } = getProviderCredentials("github");
	const token = await fetchJSON("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: id,
			client_secret: secret,
			code,
			redirect_uri: getCallbackURL("github"),
		}),
	});
	const accessToken = requireAccessToken(token);
	const user = await fetchJSON("https://api.github.com/user", {
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${accessToken}`,
			"User-Agent": "JingYue-Waline-OAuth",
		},
	});
	if (user.id === undefined || user.id === null) {
		throw new Error("GitHub did not return a stable user ID");
	}
	return {
		id: String(user.id),
		name: String(user.name || user.login || "GitHub 用户"),
		email: user.email || undefined,
		url: user.html_url,
		avatar: user.avatar_url,
	};
}

async function getProviderProfile(provider, code) {
	if (provider === "qq") return getQQProfile(code);
	if (provider === "wechat") return getWechatProfile(code);
	if (provider === "google") return getGoogleProfile(code);
	return getGithubProfile(code);
}

function readFlow(request, provider, walineType, state) {
	const nonce = verifyState(provider, state);
	if (!nonce) throw new Error("OAuth state is invalid");
	const encryptedFlow = parseCookies(request)[getCookieName(provider)];
	if (!encryptedFlow) throw new Error("OAuth state cookie is missing");
	const flow = unseal(encryptedFlow, `oauth-flow:${provider}`);
	if (
		flow.provider !== provider ||
		flow.nonce !== nonce ||
		typeof flow.expiresAt !== "number" ||
		flow.expiresAt < Date.now()
	) {
		throw new Error("OAuth state has expired");
	}
	validateWalineRedirect(flow.walineRedirect, walineType);
	return flow;
}

function handleWalineTicket(response, provider, ticket) {
	const payload = unseal(ticket, `waline-ticket:${provider}`);
	if (
		payload.provider !== provider ||
		typeof payload.expiresAt !== "number" ||
		payload.expiresAt < Date.now() ||
		!payload.profile ||
		typeof payload.profile.id !== "string"
	) {
		throw new Error("OAuth identity ticket has expired");
	}
	sendJSON(response, 200, payload.profile);
}

async function handleProvider(request, response, provider, walineType) {
	setSecurityHeaders(response);
	if (request.method !== "GET") {
		response.setHeader("Allow", "GET");
		sendJSON(response, 405, { error: "method_not_allowed" });
		return;
	}
	if (!isProviderConfigured(provider)) {
		sendJSON(response, 503, { error: `${provider}_oauth_not_configured` });
		return;
	}

	const requestURL = new URL(request.url, getServiceBaseURL());
	const code = requestURL.searchParams.get("code");
	if (code?.startsWith("fy1.")) {
		handleWalineTicket(response, provider, code);
		return;
	}

	const providerState = requestURL.searchParams.get("state");
	const providerError = requestURL.searchParams.get("error");
	const isProviderCallback = providerState?.startsWith("fs1.") ?? false;
	if (code || providerError || isProviderCallback) {
		const flow = readFlow(request, provider, walineType, providerState);
		if (providerError || !code) {
			redirectOAuthError(
				response,
				flow,
				providerError === "access_denied" ? "access_denied" : "provider_error",
			);
			return;
		}

		try {
			const profile = await getProviderProfile(provider, code);
			const ticket = seal(
				{
					provider,
					profile,
					expiresAt: Date.now() + TICKET_TTL_SECONDS * 1000,
				},
				`waline-ticket:${provider}`,
			);
			const walineCallback = new URL(flow.walineRedirect);
			walineCallback.searchParams.set("code", ticket);
			walineCallback.searchParams.set("state", flow.walineState || "");
			sendRedirect(
				response,
				walineCallback.toString(),
				createFlowCookie(provider, "", 0),
			);
		} catch {
			redirectOAuthError(response, flow, "provider_error");
		}
		return;
	}

	const walineRedirect = validateWalineRedirect(
		requestURL.searchParams.get("redirect"),
		walineType,
	);
	const nonce = randomBytes(24).toString("base64url");
	const flow = {
		provider,
		nonce,
		walineRedirect,
		walineState: requestURL.searchParams.get("state") || "",
		expiresAt: Date.now() + FLOW_TTL_SECONDS * 1000,
	};
	const encryptedFlow = seal(flow, `oauth-flow:${provider}`);
	const state = createState(provider, nonce);
	sendRedirect(
		response,
		buildAuthorizationURL(provider, state),
		createFlowCookie(provider, encryptedFlow, FLOW_TTL_SECONDS),
	);
}

export function handleServiceIndex(request, response) {
	setSecurityHeaders(response);
	try {
		setCorsHeader(request, response);
	} catch {
		sendJSON(response, 503, { error: "oauth_service_not_configured" });
		return;
	}
	if (request.method === "OPTIONS") {
		response.statusCode = 204;
		response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		response.end();
		return;
	}
	if (request.method !== "GET") {
		response.setHeader("Allow", "GET, OPTIONS");
		sendJSON(response, 405, { error: "method_not_allowed" });
		return;
	}
	sendJSON(response, 200, {
		version: SERVICE_VERSION,
		services: WALINE_SERVICES.filter(({ provider }) =>
			isProviderConfigured(provider),
		).map(({ name, provider }) => ({
			name,
			origin: providerConfig[provider].origin,
		})),
	});
}

export function createProviderHandler(provider, walineType = provider) {
	if (!PROVIDERS.includes(provider))
		throw new Error("Unsupported OAuth provider");
	return async (request, response) => {
		try {
			await handleProvider(request, response, provider, walineType);
		} catch {
			if (!response.headersSent) {
				setSecurityHeaders(response);
				sendJSON(response, 400, { error: "oauth_request_invalid" });
			}
		}
	};
}
