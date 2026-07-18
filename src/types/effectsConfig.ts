export type SakuraConfig = {
	enable: boolean; // 是否启用樱花特效
	switchable?: boolean; // 是否允许用户在设置中切换樱花特效
	sakuraNum: number; // 樱花数量，默认21
	limitTimes: number; // 樱花越界限制次数，-1为无限循环
	size: {
		min: number; // 樱花最小尺寸倍数
		max: number; // 樱花最大尺寸倍数
	};
	opacity: {
		min: number; // 樱花最小不透明度
		max: number; // 樱花最大不透明度
	};
	speed: {
		horizontal: {
			min: number; // 水平移动速度最小值
			max: number; // 水平移动速度最大值
		};
		vertical: {
			min: number; // 垂直移动速度最小值
			max: number; // 垂直移动速度最大值
		};
		rotation: number; // 旋转速度
		fadeSpeed: number; // 消失速度，不应大于最小不透明度
	};
	zIndex: number; // 层级，确保樱花在合适的层级显示
};

export type SnowConfig = {
	enable: boolean;
	switchable?: boolean;
	flakeCount: {
		desktop: number;
		mobile: number;
	};
	speed: {
		min: number;
		max: number;
	};
	size: {
		min: number;
		max: number;
	};
	opacity: {
		min: number;
		max: number;
	};
	wind: number;
	zIndex: number;
};

export type RainConfig = {
	enable: boolean; // 是否启用雨滴特效
	switchable?: boolean; // 是否允许用户在设置中切换雨滴特效
	dropCount: {
		desktop: number;
		mobile: number;
	};
	speed: {
		min: number;
		max: number;
	};
	length: {
		min: number;
		max: number;
	};
	opacity: {
		min: number;
		max: number;
	};
	wind: number; // 水平方向偏移速度
	zIndex: number;
};
