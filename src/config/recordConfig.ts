import { generatedChangelogEntries } from "./recordSync";

export interface ChangelogEntry {
	version: string;
	date: string;
	time: string;
	type: "feature" | "optimize" | "fix" | "remove";
	title: string;
	summary: string;
	changes: string[];
}

export interface RecordApp {
	name: string;
	category: "内容" | "工具" | "生活";
	description: string;
	url: string;
	icon: string;
}

const manualChangelogEntries: ChangelogEntry[] = [
	{
		version: "v6.14.5",
		date: "2026-08-10",
		time: "02:25",
		type: "optimize",
		title: "音乐歌词视角微调",
		summary: "沉浸式播放器歌词面板增加轻微的右高左低倾斜。",
		changes: [
			"桌面端歌词与制作信息面板的倾斜角度由 -0.45° 调整为 -0.9°。",
			"保留窄屏无倾斜布局，避免移动端文字裁切。",
		],
	},
	{
		version: "v6.14.4",
		date: "2026-08-10",
		time: "02:23",
		type: "fix",
		title: "灯光范围手势修复",
		summary: "灯光范围改为左键横向拖动，恢复首页滚轮翻页。",
		changes: [
			"移除光照区域对滚轮事件的拦截，首页可正常切换下一屏。",
			"光照区域内按住左键向左缩小、向右放大，普通点击仍可正常使用。",
			"照射范围上限提升至 180，并限制动态光束宽度以避免翻页后异常放大。",
		],
	},
	{
		version: "v6.14.3",
		date: "2026-08-08",
		time: "02:57",
		type: "optimize",
		title: "深色灯光追踪优化",
		summary: "光束长度改为跟随灯具与鼠标之间的实时距离。",
		changes: [
			"灯口作为光束起点，鼠标位置固定作为光束末端。",
			"鼠标远近实时控制光束长度，照射范围仅控制光束宽度。",
			"同步光斑、明暗区域与灯具朝向，避免光束和鼠标错位。",
		],
	},
	{
		version: "v6.14.2",
		date: "2026-08-08",
		time: "02:50",
		type: "feature",
		title: "留言板社交登录入口",
		summary: "留言板新增 QQ、微信、Google 与 GitHub 四种登录方式选择。",
		changes: [
			"新增统一的账号登录弹层与四渠道品牌图标。",
			"支持 Waline 原生 GitHub 登录，并为 QQ、微信、Google 接入公开 OAuth 地址配置。",
			"增加 OAuth 回跳令牌校验与未配置渠道提示。",
		],
	},
	{
		version: "v6.14.1",
		date: "2026-07-30",
		time: "23:40",
		type: "feature",
		title: "记录中心与视觉系统升级",
		summary: "补齐记录菜单的六个独立页面，并统一全站中文字体层级。",
		changes: [
			"新增书架、影视与游戏、音乐、更新日志、足迹、应用展示入口。",
			"书架与影视/游戏接入 Bangumi 实时收藏数据。",
			"音乐页接入播放队列、收藏、网易云同步与沉浸播放能力。",
			"全站切换为霞鹜文楷，基准字号统一为 16px / 24px。",
		],
	},
	{
		version: "v6.14.0",
		date: "2026-07-29",
		time: "18:20",
		type: "optimize",
		title: "归档与知识图谱重构",
		summary: "归档页加入年度热力图、时间轴和可交互的文章知识图谱。",
		changes: [
			"重做归档时间轴和左右信息栏。",
			"新增按文章标签自动生成的知识图谱。",
			"修正导航栏路由高亮与非首页壁纸切换。",
		],
	},
	{
		version: "v6.13.0",
		date: "2026-07-28",
		time: "22:15",
		type: "fix",
		title: "壁纸与播放器体验更新",
		summary: "完善横幅、全屏与纯色背景模式，并重做音乐播放器。",
		changes: [
			"壁纸选择后自动关闭选择界面。",
			"统一卡片透明度、导航透明度与背景模糊逻辑。",
			"新增迷你播放器、音乐库与沉浸播放界面。",
		],
	},
	{
		version: "v6.12.0",
		date: "2026-07-27",
		time: "20:30",
		type: "feature",
		title: "内容互动体验升级",
		summary: "补齐说说、留言板和文章详情的互动体验。",
		changes: [
			"新增说说评论弹窗和独立评论区。",
			"优化文章详情评论、加载动效与留言板排版。",
		],
	},
	{
		version: "v6.11.0",
		date: "2026-07-25",
		time: "22:30",
		type: "optimize",
		title: "相册与多页面视觉统一",
		summary: "统一相册、足迹、分类和应用展示页面的视觉语言。",
		changes: [
			"重做相册瀑布流与分类页卡片。",
			"同步侧栏、按钮、字体与页面间距。",
		],
	},
	{
		version: "v6.10.1",
		date: "2026-07-23",
		time: "02:30",
		type: "fix",
		title: "稳定性修复",
		summary: "修复背景随机、评论系统与移动端加载问题。",
		changes: [
			"修复首页背景随机切换与评论初始化。",
			"压缩图片并优化移动端首屏加载。",
		],
	},
	{
		version: "v6.10.0",
		date: "2026-07-16",
		time: "01:30",
		type: "remove",
		title: "旧组件清理",
		summary: "移除不再使用的旧式导航与重复页面入口。",
		changes: [
			"删除过时的页面按钮和重复返回入口。",
			"清理旧播放器样式与无效配置。",
		],
	},
];

export const changelogEntries: ChangelogEntry[] = [
	...generatedChangelogEntries.map((entry) => ({
		...entry,
		changes: [...entry.changes],
	})),
	...manualChangelogEntries,
];

export const recordApps: RecordApp[] = [
	{
		name: "文章索引",
		category: "内容",
		description: "浏览文章、分类、标签与置顶内容。",
		url: "/posts/",
		icon: "material-symbols:article-rounded",
	},
	{
		name: "知识图谱",
		category: "工具",
		description: "从标签关系探索归档文章。",
		url: "/archive/#knowledge-graph",
		icon: "material-symbols:hub",
	},
	{
		name: "音乐放映室",
		category: "生活",
		description: "管理播放队列、收藏和网易云歌单。",
		url: "/music/",
		icon: "material-symbols:music-note-rounded",
	},
	{
		name: "相册",
		category: "生活",
		description: "查看照片、插画与视觉收藏。",
		url: "/gallery/",
		icon: "material-symbols:photo-library-outline-rounded",
	},
	{
		name: "网站导航",
		category: "工具",
		description: "集中访问常用站点与在线工具。",
		url: "/links/",
		icon: "material-symbols:travel-explore-rounded",
	},
	{
		name: "留言板",
		category: "内容",
		description: "进入聊天室式留言区，与访客交流。",
		url: "/guestbook/",
		icon: "material-symbols:chat-bubble-outline-rounded",
	},
];
