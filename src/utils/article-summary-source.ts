import { createHash } from "node:crypto";

export function articleSummarySource(
	title: string,
	body: string,
): {
	title: string;
	text: string;
	version: string;
} {
	return {
		title,
		text:
			body.length > 18_000
				? `${body.slice(0, 14_000)}\n[中间内容省略]\n${body.slice(-4_000)}`
				: body,
		version: createHash("sha256").update(`${title}\n${body}`).digest("hex"),
	};
}
