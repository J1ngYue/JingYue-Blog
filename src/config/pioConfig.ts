import type { Live2DWidgetConfig, SpineModelConfig } from "../types/pioConfig";

export const characterModelCatalog = [
	{
		id: "firefly",
		label: "萤火虫",
		description: "本地 Spine · 可点击互动",
		type: "spine",
		preview: "/pio/models/spine/firefly/1310.png",
	},
	{
		id: "snow-miku",
		label: "雪未来",
		description: "本地 Live2D · 清新冬日",
		type: "live2d",
		live2dIndex: 0,
		preview: "/pio/models/live2d/snow_miku/textures/texture_00.png",
	},
	{
		id: "totoro",
		label: "龙猫",
		description: "像素宠物 · 温柔陪伴",
		type: "sprite",
		preview: "/pio/models/pets/totoro/spritesheet.webp",
		sprite: "/pio/models/pets/totoro/spritesheet.webp",
	},
	{
		id: "gugugaga",
		label: "咕咕嘎嘎",
		description: "像素宠物 · 企鹅搭档",
		type: "sprite",
		preview: "/pio/models/pets/gugugaga/spritesheet.webp",
		sprite: "/pio/models/pets/gugugaga/spritesheet.webp",
	},
	{
		id: "feibi",
		label: "菲比啾比",
		description: "像素宠物 · 轻巧精灵",
		type: "sprite",
		preview: "/pio/models/pets/feibi/spritesheet.webp",
		sprite: "/pio/models/pets/feibi/spritesheet.webp",
	},
	{
		id: "nailong",
		label: "奶龙",
		description: "像素宠物 · 元气小龙",
		type: "sprite",
		preview: "/pio/models/pets/nailong/spritesheet.webp",
		sprite: "/pio/models/pets/nailong/spritesheet.webp",
	},
	{
		id: "chino",
		label: "智乃",
		description: "Live2D · 轻盈日常",
		type: "live2d",
		live2dIndex: 1,
		preview: "https://model.hacxy.cn/chino/chino.png",
	},
	{
		id: "rem",
		label: "蕾姆",
		description: "Live2D · 蓝色女仆",
		type: "live2d",
		live2dIndex: 2,
		preview: "https://model.hacxy.cn/rem/rem.png",
	},
	{
		id: "hiyori",
		label: "日和",
		description: "Live2D Cubism 3 · 元气",
		type: "live2d",
		live2dIndex: 3,
		preview: "https://model.hacxy.cn/Hiyori/Hiyori.2048/texture_00.png",
	},
] as const;

// Spine 看板娘配置
export const spineModelConfig: SpineModelConfig = {
	// Spine 看板娘开关
	enable: true,

	// Spine模型配置
	model: {
		// Spine模型文件路径
		path: "/pio/models/spine/firefly/1310.json",
		// 模型缩放比例
		scale: 1.0,
		// X轴偏移
		x: 0,
		// Y轴偏移
		y: 0,
	},

	// 位置配置
	position: {
		// 显示位置 bottom-left，bottom-right，top-left，top-right，注意：在右下角可能会挡住返回顶部按钮
		corner: "bottom-left",
		// 距离边缘0px
		offsetX: 0,
		// 距离下边缘0px
		offsetY: 0,
	},

	// 尺寸配置
	size: {
		// 容器宽度
		width: 135,
		// 容器高度
		height: 165,
	},

	// 交互配置
	interactive: {
		// 交互功能开关
		enabled: true,
		// 点击时随机播放的动画列表
		clickAnimations: [
			"emoji_0",
			"emoji_1",
			"emoji_2",
			"emoji_3",
			"emoji_4",
			"emoji_5",
		],
		// 不显示点击气泡，避免连续出现文字标签
		clickMessages: [],
		// 文字显示时间（毫秒）
		messageDisplayTime: 3000,
		// 待机动画列表
		idleAnimations: ["idle"],
		// 待机动画切换间隔（毫秒）
		idleInterval: 8000,
	},

	// 响应式配置
	responsive: {
		// 在移动端隐藏
		hideOnMobile: true,
		// 移动端断点
		mobileBreakpoint: 768,
	},

	// 层级
	zIndex: 1000, // 层级

	// 透明度
	opacity: 1.0,
};

// Live2D 看板娘配置 (使用 l2d-widget 库，文档：https://l2d-widget.hacxy.cn)
export const live2dWidgetConfig: Live2DWidgetConfig = {
	// Live2D 看板娘开关
	enable: true,
	// 模型配置，支持单个模型或数组（多模型切换）
	model: [
		{
			// Live2D模型本地文件路径
			path: "/pio/models/live2d/snow_miku/model.json",
			// 动作声音音量 范围0~1，默认 0（静音）
			volume: 0,
			// 模型缩放比例
			scale: 1,
			// X轴偏移，范围 -2~2，正值向右
			x: 0,
			// Y轴偏移，范围 -2~2，正值向上
			y: 0,
		},
		{
			path: "https://model.hacxy.cn/chino/model.json",
			volume: 0,
			scale: 1,
			x: 0,
			y: 0,
		},
		{
			path: "https://model.hacxy.cn/rem/model.json",
			volume: 0,
			scale: 1,
			x: 0,
			y: 0,
		},
		{
			path: "https://model.hacxy.cn/Hiyori/Hiyori.model3.json",
			volume: 0,
			scale: 1,
			x: 0,
			y: 0,
		},
	],
	// 显示位置：bottom-left 或 bottom-right
	position: "bottom-left" as const,
	// 画布尺寸（px）
	size: { width: 200, height: 200 },
	// 主题色，用于菜单、状态条等 UI 元素的背景色，默认 'rgba(96,165,250,0.9)'
	primaryColor: "var(--l2d-msg-bg)",
	// 入场/退场动画时长（ms）
	transitionDuration: 1500,
	// 入场/退场动画类型
	transitionType: "slide" as const,
	// 菜单配置
	menus: {
		// 完全替换默认菜单项
		items: [
			{
				icon: "mdi:home",
				label: "返回主页",
				action: "home",
			},
			{
				icon: "mdi:arrow-up",
				label: "返回顶部",
				action: "scrollToTop",
			},
			{
				icon: "mdi:github",
				label: "GitHub",
				action: "github",
			},
		],
		// 菜单对齐方式
		align: "right" as const,
	},
	// 提示气泡配置
	tips: {
		// 气泡开关
		enable: true,
		// 初始欢迎消息
		welcomeMessage: ["你好呀！", "欢迎来到我的世界！"],
		// 循环提示内容
		messages: [
			"有什么需要帮助的吗？",
			"今天天气真不错呢！",
			"要不要一起玩游戏？",
			"记得按时休息哦！",
		],
		// 文字显示时间（ms）
		duration: 3000,
		// 提示气泡切换间隔（ms）
		interval: 6000,
		// 位置偏移量（px），基于默认位置（模型正上方居中）进行微调
		offset: {
			x: 0, // 正值右移，负值左移
			y: 0, // 正值下移，负值上移
		},
	},
	// 响应式配置
	responsive: {
		// 在移动端隐藏
		hideOnMobile: true,
		// 移动端断点
		mobileBreakpoint: 768,
	},
};
