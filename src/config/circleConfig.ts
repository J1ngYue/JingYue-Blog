type CircleConfig = {
	assetBaseUrl: string;
	cacheTime: number;
	dataUrl: string;
	description: string;
	pageSize: number;
	title: string;
};

export const circleConfig: CircleConfig = {
	title: "朋友圈",
	description: "看看朋友们最近写了什么。",
	dataUrl: "https://cir.tsh520.cn/data.json",
	assetBaseUrl: "https://blog.tsh520.cn/",
	pageSize: 20,
	cacheTime: 5 * 60 * 1000,
};
