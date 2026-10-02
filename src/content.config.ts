import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

type PostData = {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	notice: string;
	image: string;
	tags: string[];
	category: string | null;
	lang: string;
	pinned: boolean;
	author: string;
	sourceLink: string;
	licenseName: string;
	licenseUrl: string;
	comment: boolean;
	password: string;
	passwordHint: string;
	prevTitle: string;
	prevSlug: string;
	nextTitle: string;
	nextSlug: string;
};

type DynamicData = { published: Date; pinned: boolean; tags: string[] };

type NotebookData = {
	title: string;
	notebook: string;
	slug: string;
	published: Date;
	updated?: Date;
	description: string;
	tags: string[];
	draft: boolean;
};

const postsSchema: z.ZodType<PostData> = z.object({
	title: z.string(),
	published: z.date(),
	updated: z.date().optional(),
	draft: z.boolean().optional().default(false),
	description: z.string().optional().default(""),
	notice: z.string().optional().default(""),
	image: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	category: z.string().optional().nullable().default(""),
	lang: z.string().optional().default(""),
	pinned: z.boolean().optional().default(false),
	author: z.string().optional().default(""),
	sourceLink: z.string().optional().default(""),
	licenseName: z.string().optional().default(""),
	licenseUrl: z.string().optional().default(""),
	comment: z.boolean().optional().default(true),
	password: z.string().optional().default(""),
	passwordHint: z.string().optional().default(""),

	/* For internal use */
	prevTitle: z.string().default(""),
	prevSlug: z.string().default(""),
	nextTitle: z.string().default(""),
	nextSlug: z.string().default(""),
});

const postsCollection: ReturnType<typeof defineCollection<typeof postsSchema>> =
	defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
		schema: postsSchema,
	});

const specSchema: z.ZodType<Record<string, never>> = z.object({});
const specCollection: ReturnType<typeof defineCollection<typeof specSchema>> =
	defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
		schema: specSchema,
	});

const dynamicSchema: z.ZodType<DynamicData> = z.object({
	published: z.date(),
	pinned: z.boolean().optional().default(false),
	tags: z.array(z.string()).optional().default([]),
});
const dynamicCollection: ReturnType<
	typeof defineCollection<typeof dynamicSchema>
> = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/dynamic" }),
	schema: dynamicSchema,
});

const notebooksSchema: z.ZodType<NotebookData> = z.object({
	title: z.string(),
	notebook: z.string(),
	slug: z.string(),
	published: z.date(),
	updated: z.date().optional(),
	description: z.string().optional().default(""),
	tags: z.array(z.string()).optional().default([]),
	draft: z.boolean().optional().default(false),
});
const notebooksCollection: ReturnType<
	typeof defineCollection<typeof notebooksSchema>
> = defineCollection({
	loader: glob({
		pattern: "**/*.{md,mdx}",
		base: "./src/content/notebooks",
	}),
	schema: notebooksSchema,
});

export const collections: {
	dynamic: typeof dynamicCollection;
	notebooks: typeof notebooksCollection;
	posts: typeof postsCollection;
	spec: typeof specCollection;
} = {
	dynamic: dynamicCollection,
	notebooks: notebooksCollection,
	posts: postsCollection,
	spec: specCollection,
};
