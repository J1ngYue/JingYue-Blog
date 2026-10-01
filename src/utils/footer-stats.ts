export function formatFooterUptime(
	start: number,
	now: number = Date.now(),
): string {
	const seconds = Math.max(0, Math.floor((now - start) / 1000));
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `本站已运行 ${days} 天 ${hours} 时 ${minutes} 分 ${seconds % 60} 秒`;
}

export function formatFooterUpdate(
	updated: number,
	now: number = Date.now(),
): string {
	const days = Math.max(0, Math.floor((now - updated) / 86400000));
	return days === 0 ? "最后更新于今天" : `最后更新于 ${days} 天前`;
}
