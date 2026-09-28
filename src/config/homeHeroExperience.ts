export interface HomeHeroDialogueLine {
	speaker: "host" | "visitor";
	text: string;
}

export interface HomeHeroDialogueTopic {
	title: string;
	lines: readonly HomeHeroDialogueLine[];
}

export interface HomeHeroExperience {
	workHours: { start: number; end: number; weekdays: readonly number[] };
	dialogue: {
		enabled: boolean;
		hostName: string;
		visitorName: string;
		menuTitle: string;
		typingSpeed: number;
		autoDelay: number;
		intro: readonly HomeHeroDialogueLine[];
		topics: readonly HomeHeroDialogueTopic[];
	};
	hud: { mode: string; shutter: string; exposure: string; panel: string };
}

export const homeHeroExperience: HomeHeroExperience = {
	workHours: {
		start: 9,
		end: 18,
		weekdays: [1, 2, 3, 4, 5],
	},
	dialogue: {
		enabled: true,
		hostName: "JingYue",
		visitorName: "访客",
		menuTitle: "想聊点什么？",
		typingSpeed: 38,
		autoDelay: 1800,
		intro: [
			{ speaker: "host", text: "欢迎来到JingYue的博客" },
			{ speaker: "host", text: "这里记录代码、生活，也收藏偶尔闪过的微光。" },
			{
				speaker: "host",
				text: "你可以继续向下探索，也可以先挑一个话题和我聊聊。",
			},
		],
		topics: [
			{
				title: "关于我",
				lines: [
					{ speaker: "visitor", text: "屏幕后面的你是怎样的人？" },
					{
						speaker: "host",
						text: "我是 JingYue，喜欢把技术、设计与日常放在同一片个人空间里。",
					},
					{
						speaker: "host",
						text: "如果你也喜欢折腾网页，我们大概会很聊得来。",
					},
				],
			},
			{
				title: "博客有什么",
				lines: [
					{ speaker: "visitor", text: "这个博客有哪些值得玩的功能？" },
					{
						speaker: "host",
						text: "你可以为七个主要页面分别设置壁纸，还能调整透明度与特效。",
					},
					{
						speaker: "host",
						text: "左侧工具栏、音乐播放器和桌面宠物也会一路陪你浏览。",
					},
					{
						speaker: "host",
						text: "文章、动态、相册和聊天式留言区都有各自的入口。",
					},
				],
			},
			{
				title: "从哪里开始",
				lines: [
					{ speaker: "visitor", text: "第一次来，我应该从哪里开始？" },
					{ speaker: "host", text: "想安静阅读就去文章，想看近况就去动态。" },
					{ speaker: "host", text: "如果只想慢慢逛，点一下“向下探索”就好。" },
				],
			},
		],
	},
	hud: {
		mode: "MNL",
		shutter: "1/125",
		exposure: "3dB",
		panel: "BLOG",
	},
} as const;
