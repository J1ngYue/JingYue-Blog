import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告内容
	content: "欢迎来到 JingYue，愿你在这里度过一段轻松的时光。",
	secondaryContent: "最近更新：新增文章与动态模块",
	tickerItems: [
		{
			tag: "优化",
			content: "站点已升级至 Astro 7，首页动效与浏览体验持续打磨。",
			sort: 3,
		},
		{
			tag: "友链",
			content: "欢迎交换友链，申请前请先查看友链页说明，期待与你交换链接。",
			sort: 2,
		},
		{
			tag: "欢迎",
			content: "愿你在 JingYue 的博客里，遇见值得停留的一束微光。",
			sort: 1,
		},
	],

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "了解更多",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};
