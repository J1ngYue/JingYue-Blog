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
		version: "v6.14.18",
		date: "2026-08-13",
		time: "01:15",
		type: "optimize",
		title: "骷髅开关骨手重绘",
		summary: "重绘白骨手的手掌、指骨和双骨前臂，强化抓取推拉效果。",
		changes: [
			"分离上下两根前臂骨并补全两端关节，让伸展状态保持完整清晰。",
			"放大掌骨和四根手指，使手掌能明显抓住骷髅侧面。",
			"新增抓紧与松开的手掌形变，继续保持双向推拉动画完整重播。",
		],
	},
	{
		version: "v6.14.17",
		date: "2026-08-13",
		time: "00:57",
		type: "optimize",
		title: "文章阅读与布局开关升级",
		summary: "重做文章阅读侧栏、卡片边框状态与骷髅骨手推拉动画。",
		changes: [
			"文章阅读页新增左侧全高可收起目录，右侧文章树仅在悬浮或聚焦时展开。",
			"正文标题、元信息与摘要改为居中阅读布局，并限制封面高度。",
			"骷髅布局开关按骨手伸入、推拉、退出三个阶段播放，每次切换完整镜像重播。",
			"文章卡片默认统一为透明白色与浅灰边框，悬浮或选中时才显示黑色边框。",
		],
	},
	{
		version: "v6.14.16",
		date: "2026-08-10",
		time: "04:13",
		type: "optimize",
		title: "文章列表横向卡片重制",
		summary: "参照目标页面将文章列表改为封面渐隐的三层横向卡片。",
		changes: [
			"将列表视图从左图右文改为整张横向卡片，封面在右侧以低透明度融入背景。",
			"新增从卡片底色到封面的多段渐变，统一深浅色模式下的文字可读性。",
			"重新排列置顶、标题、分类、日期、标签与摘要，形成清晰的三层信息结构。",
			"保留分类筛选、骷髅布局开关、网格视图和移动端响应式布局。",
		],
	},
	{
		version: "v6.14.15",
		date: "2026-08-10",
		time: "04:05",
		type: "fix",
		title: "默认动态壁纸持久化修正",
		summary: "将蓝色忧郁视频设为代码默认壁纸，并统一刷新后的选择来源。",
		changes: [
			"将蓝色忧郁 MP4 正式加入站点静态资源并设为第一默认壁纸。",
			"为内置壁纸补充图片与视频类型，刷新后继续渲染正确的媒体组件。",
			"让系统默认值、管理员默认值与壁纸选择器共用同一默认壁纸标识。",
			"保留用户选择的页面壁纸；本地记录失效时自动回退到默认视频。",
		],
	},
	{
		version: "v6.14.14",
		date: "2026-08-10",
		time: "03:40",
		type: "feature",
		title: "足迹地图完整重制",
		summary: "参照目标页面重做足迹地图、统计与旅行记录交互。",
		changes: [
			"接入 Leaflet 与 OpenStreetMap 实际地图，替换原有装饰网格地图。",
			"新增地图锁定、全屏、缩放、视野复位、年份筛选与足迹集群显示。",
			"支持点击地图选择位置、记录到访次数，以及为已有足迹重新定位。",
			"统一三项胶囊统计、地图控制和旅行记录区的明暗主题与响应式样式。",
		],
	},
	{
		version: "v6.14.13",
		date: "2026-08-10",
		time: "03:30",
		type: "remove",
		title: "关于导航精简",
		summary: "从关于菜单中移除社交主页入口。",
		changes: [
			"删除关于下拉菜单中的社交主页子项。",
			"保留关于、友情链接与赞助支持入口。",
		],
	},
	{
		version: "v6.14.12",
		date: "2026-08-10",
		time: "03:21",
		type: "fix",
		title: "快捷工具箭头方向修正",
		summary: "修正快捷工具栏展开与收起状态的箭头方向。",
		changes: [
			"对调展开和收起状态的箭头朝向，使图标与当前操作保持一致。",
			"保留原有平滑旋转与工具栏折叠动画。",
		],
	},
	{
		version: "v6.14.11",
		date: "2026-08-10",
		time: "03:19",
		type: "fix",
		title: "放映室跨页进入修复",
		summary: "修复从动态页进入音乐页后打开放映室只显示空白遮罩的问题。",
		changes: [
			"保留沉浸式播放器与音乐地形的常驻样式，避免无刷新切页时被 Swup 清除。",
			"放映室外壳与播放器内容保持同一生命周期，不再出现遮罩已打开但内容未渲染的状态。",
			"覆盖动态页进入音乐页后再打开，以及直接打开音乐页两条访问路径。",
		],
	},
	{
		version: "v6.14.10",
		date: "2026-08-10",
		time: "03:03",
		type: "fix",
		title: "更新日志展开交互修复",
		summary: "恢复更新日志在无刷新切页后的点击展开与平滑收起。",
		changes: [
			"改用全站常驻事件委托，直接打开、无刷新切页及前进后退时均可展开日志。",
			"每次初始化同步展开状态与无障碍属性，避免箭头状态和内容状态不一致。",
			"保留可反向衔接的高度与透明度过渡，连续点击时也能平滑展开或收起。",
		],
	},
	{
		version: "v6.14.9",
		date: "2026-08-10",
		time: "02:56",
		type: "fix",
		title: "文章布局开关推拉动画修复",
		summary: "重做骷髅布局开关的骨手推拉轨迹，消除动画重叠。",
		changes: [
			"统一骷髅与骨手的移动时长和轨迹，让骨手完整跟随开关左右推拉。",
			"调整动画层级，使骨手始终位于骷髅后方，不再遮挡面部。",
			"使用位移与透明度动画替代位置跳变，并保留减少动态效果设置。",
		],
	},
	{
		version: "v6.14.8",
		date: "2026-08-10",
		time: "02:50",
		type: "optimize",
		title: "网站导航品牌图标升级",
		summary: "导航卡片改用对应站点的品牌图标与官方主色。",
		changes: [
			"GitHub、Bilibili、网易云音乐等外部入口替换为对应品牌 SVG 图标。",
			"为 Cloudflare、Astro、Svelte、Tailwind、OpenAI 等站点应用品牌主色。",
			"站内入口按功能使用独立语义色，并优化深浅色模式下的图标对比度。",
		],
	},
	{
		version: "v6.14.7",
		date: "2026-08-10",
		time: "02:46",
		type: "optimize",
		title: "全站信息侧栏统一",
		summary: "统一带左右信息栏页面的模块与视觉结构，并新增完整站点统计。",
		changes: [
			"网站导航接入记录中心同款共享侧栏，个人资料、天气、日历及右侧信息模块保持一致。",
			"在左侧日历下方新增站点统计，展示文章、动态、记录、分类、标签、字数、运行时长与最后活动。",
			"最后活动时间综合文章、动态与更新日志计算，避免旧文章日期导致统计失真。",
		],
	},
	{
		version: "v6.14.6",
		date: "2026-08-10",
		time: "02:33",
		type: "fix",
		title: "非首页背景与留言板留白修复",
		summary: "非首页默认使用纯色背景，并让留言板按当前背景模式正确定位。",
		changes: [
			"首页与非首页分别保存背景模式，未设置的非首页统一使用纯色背景。",
			"移除留言板对横幅的强制隐藏，手动选择横幅背景后可正常显示。",
			"留言板在纯色模式下紧贴导航栏，横幅模式下自动恢复横幅间距。",
		],
	},
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
