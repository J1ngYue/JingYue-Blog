import desktop1 from "@/assets/images/DesktopWallpaper/d1.avif";
import desktop2 from "@/assets/images/DesktopWallpaper/d2.avif";
import desktop3 from "@/assets/images/DesktopWallpaper/d3.avif";
import desktop4 from "@/assets/images/DesktopWallpaper/d4.avif";
import mobile1 from "@/assets/images/MobileWallpaper/m1.avif";
import mobile2 from "@/assets/images/MobileWallpaper/m2.avif";
import mobile3 from "@/assets/images/MobileWallpaper/m3.avif";
import mobile4 from "@/assets/images/MobileWallpaper/m4.avif";

export interface PageWallpaperAsset {
	id: `wallpaper-${number}`;
	label: string;
	desktopUrl: string;
	mobileUrl: string;
}

export const pageWallpaperAssets: PageWallpaperAsset[] = [
	{
		id: "wallpaper-1",
		label: "常用封面 01",
		desktopUrl: desktop1.src,
		mobileUrl: mobile1.src,
	},
	{
		id: "wallpaper-2",
		label: "常用封面 02",
		desktopUrl: desktop2.src,
		mobileUrl: mobile2.src,
	},
	{
		id: "wallpaper-3",
		label: "常用封面 03",
		desktopUrl: desktop3.src,
		mobileUrl: mobile3.src,
	},
	{
		id: "wallpaper-4",
		label: "常用封面 04",
		desktopUrl: desktop4.src,
		mobileUrl: mobile4.src,
	},
];
