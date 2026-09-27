<script lang="ts">
import { onMount } from "svelte";

type Event = {
	id: string;
	date: string;
	title: string;
	note: string;
	kind: string;
	recurring: number;
	remind: number;
};
type Bill = {
	id: string;
	date: string;
	amount_cents: number;
	type: "expense" | "income";
	note: string;
	category: string;
};
let { mode, apiBase }: { mode: "events" | "bills"; apiBase: string } = $props();
let authenticated = $state(false);
let loading = $state(true);
let busy = $state(false);
let error = $state("");
let password = $state("");
let events = $state<Event[]>([]);
let bills = $state<Bill[]>([]);
let editing = $state("");
let date = $state(new Date().toLocaleDateString("sv-SE"));
let title = $state("");
let note = $state("");
let kind = $state("auto");
let recurring = $state(false);
let remind = $state(true);
let amount = $state("");
let type = $state<"expense" | "income">("expense");
let category = $state("auto");
let monthOffset = $state(0);
const eventKinds = ["auto", "birthday", "anniversary", "holiday", "other"];
const kindLabels: Record<string, string> = {
	auto: "AI 自动识别",
	birthday: "生日",
	anniversary: "纪念日",
	holiday: "节假日",
	other: "其他",
};
const categories = [
	"auto",
	"餐饮",
	"交通",
	"购物",
	"住房",
	"学习",
	"娱乐",
	"医疗",
	"API费用",
	"其他",
];
const money = (cents: number) => (cents / 100).toFixed(2);
const today = () => new Date().toLocaleDateString("sv-SE");
const dayNumber = (value: string) =>
	Math.floor(new Date(`${value}T00:00:00`).getTime() / 86_400_000);
const nextDate = (event: Event) => {
	if (!event.recurring) return event.date;
	const year = new Date().getFullYear();
	for (let nextYear = year; nextYear <= year + 4; nextYear++) {
		const candidate = `${nextYear}-${event.date.slice(5)}`;
		if (
			candidate >= today() &&
			new Date(`${candidate}T00:00:00Z`).toISOString().slice(0, 10) ===
				candidate
		)
			return candidate;
	}
	return event.date;
};
const calendarMonth = $derived(
	new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1),
);
const monthKey = $derived(
	`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`,
);
const calendarDays = $derived.by(() => {
	const firstWeekday = new Date(
		calendarMonth.getFullYear(),
		calendarMonth.getMonth(),
		1,
	).getDay();
	const length = new Date(
		calendarMonth.getFullYear(),
		calendarMonth.getMonth() + 1,
		0,
	).getDate();
	return [
		...Array(firstWeekday).fill(0),
		...Array.from({ length }, (_, i) => i + 1),
	];
});
const upcoming = $derived(
	[...events].sort((a, b) => nextDate(a).localeCompare(nextDate(b))),
);
const todayKey = $derived(today());
const expenseBills = $derived(bills.filter((bill) => bill.type === "expense"));
const summary = $derived.by(() => {
	const now = new Date();
	const d = todayKey;
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();
	const start7 = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - 6,
	).toLocaleDateString("sv-SE");
	const sum = (filter: (bill: Bill) => boolean) =>
		expenseBills
			.filter(filter)
			.reduce((total, bill) => total + bill.amount_cents, 0);
	return [
		["今日", sum((bill) => bill.date === d)],
		["近七天", sum((bill) => bill.date >= start7 && bill.date <= d)],
		["本月", sum((bill) => bill.date.startsWith(d.slice(0, 7)))],
		[
			"本季度",
			sum((bill) => {
				const [y, m] = bill.date.split("-").map(Number);
				return (
					y === currentYear &&
					Math.floor((m - 1) / 3) === Math.floor(currentMonth / 3)
				);
			}),
		],
		[
			"近半年",
			sum(
				(bill) =>
					bill.date >=
						new Date(currentYear, currentMonth - 5, 1).toLocaleDateString(
							"sv-SE",
						) && bill.date <= d,
			),
		],
		["本年", sum((bill) => bill.date.startsWith(String(currentYear)))],
	] as [string, number][];
});
const monthly = $derived.by(() => {
	const now = new Date();
	return Array.from({ length: 12 }, (_, i) => {
		const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
		const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
		return {
			key,
			label: `${month.getMonth() + 1}月`,
			value: expenseBills
				.filter((bill) => bill.date.startsWith(key))
				.reduce((total, bill) => total + bill.amount_cents, 0),
		};
	});
});
const chartPoints = $derived(
	monthly
		.map(
			(item, i) =>
				`${24 + i * 42},${140 - (item.value / Math.max(1, ...monthly.map((month) => month.value))) * 110}`,
		)
		.join(" "),
);
const categoryTotals = $derived.by(() => {
	const totals = new Map<string, number>();
	for (const bill of expenseBills)
		totals.set(
			bill.category,
			(totals.get(bill.category) || 0) + bill.amount_cents,
		);
	return [...totals].sort((a, b) => b[1] - a[1]);
});

async function request(path: string, init?: RequestInit) {
	const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
		credentials: "include",
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || "请求失败");
	return data;
}

async function refresh() {
	if (mode === "events") events = await request("/events");
	else bills = await request("/bills");
}

onMount(async () => {
	if (!apiBase) {
		loading = false;
		return;
	}
	try {
		authenticated = (await request("/auth/me")).authenticated;
		if (authenticated) await refresh();
	} catch {
		error = "私密服务暂时无法连接";
	}
	loading = false;
});

async function logIn(event: SubmitEvent) {
	event.preventDefault();
	error = "";
	busy = true;
	try {
		await request("/auth/login", {
			method: "POST",
			body: JSON.stringify({ password }),
		});
		password = "";
		authenticated = true;
		await refresh();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "登录失败";
	}
	busy = false;
}

async function logOut() {
	try {
		await request("/auth/logout", { method: "POST" });
	} catch {
		/* Hide private data even when offline. */
	}
	authenticated = false;
	events = [];
	bills = [];
	editing = "";
}

function resetForm() {
	editing = "";
	date = today();
	title = "";
	note = "";
	kind = "auto";
	recurring = false;
	remind = true;
	amount = "";
	type = "expense";
	category = "auto";
}

function editEvent(item: Event) {
	editing = item.id;
	date = item.date;
	title = item.title;
	note = item.note;
	kind = item.kind;
	recurring = !!item.recurring;
	remind = !!item.remind;
}

function editBill(item: Bill) {
	editing = item.id;
	date = item.date;
	note = item.note;
	amount = money(item.amount_cents);
	type = item.type;
	category = item.category;
}

async function save(event: SubmitEvent) {
	event.preventDefault();
	error = "";
	busy = true;
	try {
		const payload =
			mode === "events"
				? { date, title, note, kind, recurring, remind }
				: {
						date,
						note,
						amount_cents: Math.round(Number(amount) * 100),
						type,
						category,
					};
		await request(`/${mode}${editing ? `/${editing}` : ""}`, {
			method: editing ? "PUT" : "POST",
			body: JSON.stringify(payload),
		});
		resetForm();
		await refresh();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "保存失败";
	}
	busy = false;
}

async function remove(id: string) {
	if (!confirm("确定删除这条记录吗？")) return;
	error = "";
	try {
		await request(`/${mode}/${id}`, { method: "DELETE" });
		await refresh();
	} catch (cause) {
		error = cause instanceof Error ? cause.message : "删除失败";
	}
}

function hasEvent(day: number) {
	const key = `${monthKey}-${String(day).padStart(2, "0")}`;
	return events.some(
		(event) =>
			event.date === key ||
			(event.recurring && event.date.slice(5) === key.slice(5)),
	);
}
</script>

<section class="private-hub">
	{#if loading}
		<p class="status">正在检查私密空间…</p>
	{:else if !apiBase}
		<div class="lock-card"><span class="eyebrow">PRIVATE SPACE</span><h2>私密空间尚未启用</h2><p>后端和数据库配置完成后，这里才会开放。日历与账单数据不会存入公开页面。</p></div>
	{:else if !authenticated}
		<form class="lock-card" onsubmit={logIn}>
			<span class="eyebrow">PRIVATE SPACE</span><h2>仅自己可见</h2><p>输入管理密码，解锁{mode === "events" ? "日历" : "账单"}。</p>
			<label>管理密码<input type="password" autocomplete="current-password" bind:value={password} required /></label>
			<button class="primary" type="submit" disabled={busy}>解锁空间</button>
		</form>
	{:else}
		<div class="hub-top"><div><span class="eyebrow">JINGYUE · PRIVATE</span><h2>{mode === "events" ? "我的倒数日" : "我的账本"}</h2></div><button type="button" class="ghost" onclick={logOut}>锁定</button></div>
		{#if mode === "events"}
			<div class="hub-grid">
				<section class="panel calendar-panel"><div class="panel-head"><h3>{calendarMonth.getFullYear()} 年 {calendarMonth.getMonth() + 1} 月</h3><div><button type="button" class="icon" aria-label="上个月" onclick={() => monthOffset--}>‹</button><button type="button" class="icon" aria-label="下个月" onclick={() => monthOffset++}>›</button></div></div><div class="calendar-grid">{#each ["日", "一", "二", "三", "四", "五", "六"] as weekday}<span class="weekday">{weekday}</span>{/each}{#each calendarDays as day}<span class:marked={!!day && hasEvent(day)} class:current={!!day && `${monthKey}-${String(day).padStart(2, "0")}` === todayKey}>{day || ""}</span>{/each}</div></section>
				<section class="panel"><h3>添加重要日子</h3><form class="entry-form" onsubmit={save}><label>日期<input type="date" bind:value={date} required /></label><label>名称<input type="text" maxlength="100" bind:value={title} placeholder="生日、纪念日或节假日" required /></label><label>说明<textarea maxlength="1000" rows="3" bind:value={note} placeholder="写下想记住的事"></textarea></label><label>类型<select bind:value={kind}>{#each eventKinds as option}<option value={option}>{kindLabels[option]}</option>{/each}</select></label><div class="toggles"><label><input type="checkbox" bind:checked={recurring} />每年重复</label><label><input type="checkbox" bind:checked={remind} />提前一天发邮件</label></div><div class="actions"><button class="primary" type="submit" disabled={busy}>{editing ? "保存修改" : "添加日子"}</button>{#if editing}<button class="ghost" type="button" onclick={resetForm}>取消</button>{/if}</div></form></section>
			</div>
			<section class="panel list-panel">
				<h3>所有重要日子</h3>
				{#if !upcoming.length}<p class="empty">还没有记录，先添加一个重要日子吧。</p>{/if}
				<div class="entries">
					{#each upcoming as item (item.id)}
						{@const remaining = dayNumber(nextDate(item)) - dayNumber(todayKey)}
						<article class="entry">
							<div class="day-badge"><strong>{Math.abs(remaining)}</strong><small>{remaining < 0 ? "天前" : "天后"}</small></div>
							<div class="entry-copy"><strong>{item.title}</strong><span>{nextDate(item)} · {kindLabels[item.kind] || "其他"}{item.recurring ? " · 每年" : ""}{item.remind ? " · 邮件提醒" : ""}</span>{#if item.note}<p>{item.note}</p>{/if}</div>
							<div class="entry-actions"><button type="button" onclick={() => editEvent(item)}>编辑</button><button type="button" onclick={() => remove(item.id)}>删除</button></div>
						</article>
					{/each}
				</div>
			</section>
		{:else}
			<div class="summary-grid">{#each summary as [label, value]}<article class="metric"><span>{label}支出</span><strong>¥{money(value)}</strong></article>{/each}</div>
			<div class="hub-grid"><section class="panel"><h3>记录一笔</h3><form class="entry-form" onsubmit={save}><div class="form-row"><label>日期<input type="date" bind:value={date} required /></label><label>金额 ¥<input type="number" min="0.01" max="100000000" step="0.01" bind:value={amount} required /></label></div><label>用途 / 说明<input type="text" maxlength="300" bind:value={note} placeholder="例如：午饭、地铁、DeepSeek API" required /></label><div class="form-row"><label>类型<select bind:value={type}><option value="expense">支出</option><option value="income">收入</option></select></label><label>分类<select bind:value={category}>{#each categories as option}<option value={option}>{option === "auto" ? "AI 自动分类" : option}</option>{/each}</select></label></div><div class="actions"><button class="primary" type="submit" disabled={busy}>{editing ? "保存修改" : "添加账单"}</button>{#if editing}<button class="ghost" type="button" onclick={resetForm}>取消</button>{/if}</div></form></section>
				<section class="panel chart-panel"><h3>近 12 个月支出</h3><svg viewBox="0 0 510 170" role="img" aria-label="近 12 个月支出折线图" preserveAspectRatio="none"><line x1="20" y1="140" x2="490" y2="140" stroke="#d8d8dc" /><polyline points={chartPoints} fill="none" stroke="#e75d8d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />{#each monthly as item, i}<circle cx={24 + i * 42} cy={140 - (item.value / Math.max(1, ...monthly.map((month) => month.value))) * 110} r="4" fill="#e75d8d"><title>{item.key}：¥{money(item.value)}</title></circle>{/each}</svg><div class="chart-labels">{#each monthly as item}<span>{item.label}</span>{/each}</div><h4>分类支出</h4>{#if !categoryTotals.length}<p class="empty">暂无支出记录</p>{:else}<div class="category-list">{#each categoryTotals as [name, value]}<div><span>{name}</span><strong>¥{money(value)}</strong></div>{/each}</div>{/if}</section></div>
			<section class="panel list-panel"><h3>每月花费</h3><div class="month-list">{#each [...monthly].reverse() as item}<span>{item.key}</span><strong>¥{money(item.value)}</strong>{/each}</div><h3>全部账单</h3>{#if !bills.length}<p class="empty">还没有账单，添加第一笔吧。</p>{/if}<div class="entries">{#each bills as item (item.id)}<article class="entry"><div class="entry-copy"><strong>{item.note}</strong><span>{item.date} · {item.category} · {item.type === "expense" ? "支出" : "收入"}</span></div><strong class:income={item.type === "income"} class="bill-amount">{item.type === "expense" ? "−" : "+"}¥{money(item.amount_cents)}</strong><div class="entry-actions"><button type="button" onclick={() => editBill(item)}>编辑</button><button type="button" onclick={() => remove(item.id)}>删除</button></div></article>{/each}</div></section>
		{/if}
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.private-hub{width:100%;color:#222;font-family:inherit}.status,.empty{color:#777}.lock-card,.panel,.metric{background:#fff;border:2px solid #242424;border-radius:22px;box-shadow:5px 6px 0 #e9e9eb}.lock-card{max-width:480px;margin:2rem auto;padding:2rem;display:grid;gap:1rem}.lock-card h2,.hub-top h2{font-size:clamp(1.7rem,3vw,2.5rem);font-weight:800;margin:0}.lock-card p{margin:0;color:#666}.eyebrow{font-size:.75rem;letter-spacing:.18em;font-weight:800;color:#d4507f}.hub-top{display:flex;align-items:end;justify-content:space-between;margin:0 0 1.4rem}.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.25rem}.panel{padding:1.5rem;min-width:0}.panel h3{font-weight:800;font-size:1.3rem;margin:0 0 1.25rem}.panel h4{font-weight:800;margin:1rem 0 .5rem}.panel-head{display:flex;align-items:center;justify-content:space-between}.panel-head h3{margin:0}.panel-head div{display:flex;gap:.4rem}.icon,.ghost,.entry-actions button{background:#fff;border:1.5px solid #333;border-radius:10px;padding:.45rem .85rem;font:inherit;cursor:pointer}.icon{min-width:44px;min-height:44px;font-size:1.5rem;line-height:1}.primary{background:#222;color:#fff;border:2px solid #222;border-radius:12px;padding:.75rem 1.2rem;min-height:44px;font:inherit;font-weight:700;cursor:pointer}.primary:disabled{opacity:.55;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #e75d8d;outline-offset:2px}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.35rem;margin-top:1.25rem}.calendar-grid span{text-align:center;border-radius:12px;min-height:42px;display:grid;place-items:center}.calendar-grid .weekday{font-size:.85rem;color:#777}.calendar-grid .marked{background:#ffe4ee;font-weight:800;color:#af285e}.calendar-grid .current{outline:2px solid #222}.entry-form{display:grid;gap:1rem}.entry-form label,.lock-card label{display:grid;gap:.4rem;font-weight:700;font-size:.9rem}.entry-form input:not([type=checkbox]),.entry-form textarea,.entry-form select,.lock-card input{width:100%;border:1.5px solid #c4c4c9;border-radius:10px;padding:.75rem;background:#fff;color:#222;font:inherit;min-height:44px}.entry-form textarea{resize:vertical}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.toggles{display:flex;gap:1.25rem;flex-wrap:wrap}.toggles label{display:flex;align-items:center;gap:.5rem;font-weight:500}.toggles input{width:18px;height:18px}.actions{display:flex;gap:.6rem;flex-wrap:wrap}.list-panel{margin-top:1.25rem}.entries{display:grid;gap:.65rem}.entry{display:flex;align-items:center;gap:1rem;padding:.85rem;border:1px solid #dedee2;border-radius:14px;min-width:0}.entry-copy{min-width:0;flex:1;display:grid;gap:.2rem}.entry-copy strong{font-weight:800;overflow-wrap:anywhere}.entry-copy span{font-size:.8rem;color:#777}.entry-copy p{margin:.2rem 0 0;font-size:.9rem;white-space:pre-wrap;overflow-wrap:anywhere}.day-badge{width:64px;flex:none;display:grid;text-align:center;border-radius:12px;background:#ffe4ee;padding:.4rem}.day-badge strong{font-size:1.35rem}.day-badge small{font-size:.7rem}.entry-actions{display:flex;gap:.4rem}.entry-actions button{font-size:.8rem;border-color:#bbb}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.85rem;margin-bottom:1.25rem}.metric{display:grid;gap:.3rem;padding:1rem}.metric span{font-size:.82rem;color:#666}.metric strong{font-size:1.4rem}.chart-panel svg{width:100%;height:170px}.chart-labels{display:flex;justify-content:space-between;gap:2px;font-size:.65rem;color:#777}.category-list{display:grid;gap:.4rem}.category-list div,.month-list{display:grid;grid-template-columns:1fr auto;gap:.4rem}.month-list{max-height:210px;overflow:auto;margin-bottom:1.5rem}.month-list span,.month-list strong{padding:.3rem 0;border-bottom:1px solid #eee}.bill-amount{white-space:nowrap;color:#cc4779}.bill-amount.income{color:#259a68}.error{color:#b42346;background:#fff0f3;border:1px solid #e8a2b2;border-radius:10px;padding:.75rem;margin-top:1rem}
	@media(max-width:800px){.hub-grid{grid-template-columns:1fr}.summary-grid{grid-template-columns:repeat(2,1fr)}.panel{padding:1rem}.entry{flex-wrap:wrap}.entry-actions{width:100%;justify-content:flex-end}.chart-labels span:nth-child(even){display:none}}
	@media(max-width:450px){.summary-grid{gap:.5rem}.metric{padding:.7rem}.metric strong{font-size:1.12rem}.form-row{grid-template-columns:1fr}.calendar-grid span{min-height:35px}.lock-card{padding:1.25rem}}
</style>
