export interface NotebookDefinition {
	slug: string;
	title: string;
	description: string;
	cover: string;
}

// Cover artwork: https://game-materials.com/ (free commercial-use materials).
export const notebookDefinitions: NotebookDefinition[] = [
	{
		slug: "engineering",
		title: "工程手记",
		description: "记录 Firefly 的开发过程、命令备忘与性能优化。",
		cover: "assets/images/notebooks/engineering.webp",
	},
	{
		slug: "daily-review",
		title: "每日复盘",
		description: "把一天里的收获、遗憾和下一步认真写下来。",
		cover: "assets/images/notebooks/daily-review.webp",
	},
	{
		slug: "inspiration",
		title: "灵感摘录",
		description: "收藏偶然闪过的句子、画面和页面构想。",
		cover: "assets/images/notebooks/inspiration.webp",
	},
	{
		slug: "learning",
		title: "学习笔记",
		description: "整理新知识、实践结论和可以复用的检查清单。",
		cover: "assets/images/notebooks/learning.webp",
	},
	{
		slug: "media-notes",
		title: "影音随记",
		description: "记录音乐、动画与电影留下的情绪和细节。",
		cover: "assets/images/notebooks/media-notes.webp",
	},
	{
		slug: "life-list",
		title: "生活清单",
		description: "保存想完成的小事、习惯和生活节奏的变化。",
		cover: "assets/images/notebooks/life-list.webp",
	},
];

export function getNotebookDefinition(slug: string) {
	return notebookDefinitions.find((notebook) => notebook.slug === slug);
}
