import assert from "node:assert/strict";
import test from "node:test";
import { getGuestbookErrorMessage } from "./guestbook-chat";

test("rate-limit errors do not call authenticated users visitors", () => {
	for (const message of ["Comment too fast!", "429 Too Many Requests"]) {
		const result = getGuestbookErrorMessage(new Error(message));
		assert.match(result, /按 IP 限制频率/u);
		assert.doesNotMatch(result, /游客/u);
	}
});
