import desktop2 from "@/assets/images/DesktopWallpaper/d2.avif";
import desktop3 from "@/assets/images/DesktopWallpaper/d3.avif";
import desktop4 from "@/assets/images/DesktopWallpaper/d4.avif";
import mobile2 from "@/assets/images/MobileWallpaper/m2.avif";
import mobile3 from "@/assets/images/MobileWallpaper/m3.avif";
import mobile4 from "@/assets/images/MobileWallpaper/m4.avif";

export interface PageWallpaperAsset {
	id: `wallpaper-${number}`;
	label: string;
	desktopUrl: string;
	mobileUrl: string;
	type: "image" | "video";
}

export const DEFAULT_PAGE_WALLPAPER_ID = "wallpaper-1" as const;

export const pageWallpaperAssets: PageWallpaperAsset[] = [
	{
		id: DEFAULT_PAGE_WALLPAPER_ID,
		label: "蓝色忧郁",
		desktopUrl: "/assets/videos/blue-melancholy.mp4",
		mobileUrl: "/assets/videos/blue-melancholy.mp4",
		type: "video",
	},
	{
		id: "wallpaper-2",
		label: "常用封面 02",
		desktopUrl: desktop2.src,
		mobileUrl: mobile2.src,
		type: "image",
	},
	{
		id: "wallpaper-3",
		label: "常用封面 03",
		desktopUrl: desktop3.src,
		mobileUrl: mobile3.src,
		type: "image",
	},
	{
		id: "wallpaper-4",
		label: "常用封面 04",
		desktopUrl: desktop4.src,
		mobileUrl: mobile4.src,
		type: "image",
	},
];
