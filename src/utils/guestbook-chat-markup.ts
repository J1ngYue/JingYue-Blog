import { marked } from "marked";

const SAFE_IMAGE_SOURCE =
	/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/iu;
const MAX_INLINE_IMAGE_SOURCE_LENGTH = 180_000;
const ALLOWED_TAGS = new Set(["p", "br", "a", "img", "strong", "em", "code"]);
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
	a: new Set(["href", "title"]),
	img: new Set(["src", "alt", "title"]),
};

function sanitizeGuestbookHtml(rendered: string): string {
	const document = new DOMParser().parseFromString(rendered, "text/html");
	const elements = Array.from(document.body.querySelectorAll("*"));

	for (const element of elements) {
		const tag = element.tagName.toLowerCase();
		if (!ALLOWED_TAGS.has(tag)) {
			if (["script", "style", "iframe", "object", "embed"].includes(tag)) {
				element.remove();
				continue;
			}
			element.replaceWith(...Array.from(element.childNodes));
			continue;
		}

		const allowedAttributes = ALLOWED_ATTRIBUTES[tag] ?? new Set<string>();
		for (const attribute of Array.from(element.attributes)) {
			if (!allowedAttributes.has(attribute.name.toLowerCase())) {
				element.removeAttribute(attribute.name);
			}
		}

		if (tag === "a") {
			const href = element.getAttribute("href") || "";
			try {
				const url = new URL(href, window.location.origin);
				if (url.protocol !== "http:" && url.protocol !== "https:") {
					element.removeAttribute("href");
				}
			} catch {
				element.removeAttribute("href");
			}
			element.setAttribute("target", "_blank");
			element.setAttribute("rel", "nofollow noopener noreferrer");
		}

		if (tag === "img") {
			const src = element.getAttribute("src") || "";
			if (
				!SAFE_IMAGE_SOURCE.test(src) ||
				src.length > MAX_INLINE_IMAGE_SOURCE_LENGTH
			) {
				element.remove();
				continue;
			}
			element.setAttribute("loading", "lazy");
			element.setAttribute("decoding", "async");
			element.setAttribute("referrerpolicy", "no-referrer");
		}
	}

	return document.body.innerHTML;
}

export function renderGuestbookMessage(body: string): string {
	const rendered = marked.parse(body, {
		async: false,
		breaks: true,
		gfm: true,
	});

	return sanitizeGuestbookHtml(String(rendered));
}
