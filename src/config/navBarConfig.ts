import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	const links: NavBarLink[] = [
		{
			...LinkPresets.Home,
			name: "首页",
		},
		{
			name: "网站导航",
			url: "/links/",
			icon: "material-symbols:globe",
		},
		{
			name: "文章",
			url: "/posts/",
			icon: "material-symbols:article-rounded",
			children: [
				{
					name: "文章列表",
					url: "/posts/",
					icon: "material-symbols:article-rounded",
				},
				LinkPresets.Archive,
				LinkPresets.Categories,
				LinkPresets.Tags,
			],
		},
		{
			name: "动态",
			url: "/dynamic/",
			icon: "material-symbols:local-cafe",
			children: [
				LinkPresets.Dynamic,
				LinkPresets.Gallery,
				LinkPresets.Guestbook,
				{
					name: "笔记本",
					url: "/life/notebooks/",
					icon: "material-symbols:menu-book-rounded",
				},
				{
					...LinkPresets.Friends,
					name: "朋友圈",
				},
			],
		},
		{
			name: "记录",
			url: "/books/",
			icon: "material-symbols:home-work-rounded",
			children: [
				{
					name: "书架",
					url: "/books/",
					icon: "material-symbols:book-4",
				},
				{
					name: "影视与游戏",
					url: "/movies-games/",
					icon: "material-symbols:movie",
				},
				{
					name: "音乐",
					url: "/music/",
					icon: "material-symbols:music-note",
				},
				{
					name: "更新日志",
					url: "/changelog/",
					icon: "material-symbols:history",
				},
				{
					name: "足迹",
					url: "/life/places/",
					icon: "material-symbols:location-on",
				},
				{
					name: "应用展示",
					url: "/apps/",
					icon: "material-symbols:apps",
				},
			],
		},
		{
			name: "关于",
			url: "/about/",
			icon: "material-symbols:info-rounded",
			children: [
				LinkPresets.About,
				{
					name: "社交主页",
					url: "/social/",
					icon: "material-symbols:group",
				},
				LinkPresets.Friends,
				LinkPresets.Sponsor,
			],
		},
	];

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Anime: {
		name: "追番",
		url: "/anime/",
		icon: "material-symbols:live-tv",
		pageKey: "anime",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
