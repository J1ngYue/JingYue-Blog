<script lang="ts">
import { onMount } from "svelte";

type EventRecord = {
	id: string;
	date: string;
	title: string;
	note: string;
	kind: string;
	recurring: number;
	remind: number;
};
type BillRecord = {
	id: string;
	date: string;
	amount_cents: number;
	type: "expense" | "income";
	note: string;
	category: string;
};

let { mode, apiBase }: { mode: "events" | "bills"; apiBase: string } = $props();
let loading = $state(true);
let authenticated = $state(false);
let busy = $state(false);
let error = $state("");
let password = $state("");
let events = $state<EventRecord[]>([]);
let bills = $state<BillRecord[]>([]);
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
let dialog: HTMLDialogElement;

const kinds = [
	["auto", "AI 自动识别"],
	["birthday", "生日"],
	["anniversary", "纪念日"],
	["holiday", "节假日"],
	["other", "其他"],
];
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
const expenses = $derived(bills.filter((bill) => bill.type === "expense"));
const totals = $derived.by(() => {
	const now = new Date();
	const current = today();
	const pastWeek = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - 6,
	).toLocaleDateString("sv-SE");
	const halfYear = new Date(
		now.getFullYear(),
		now.getMonth() - 5,
		1,
	).toLocaleDateString("sv-SE");
	const sum = (predicate: (bill: BillRecord) => boolean) =>
		expenses
			.filter(predicate)
			.reduce((total, bill) => total + bill.amount_cents, 0);
	return [
		["今日", sum((bill) => bill.date === current)],
		["近七天", sum((bill) => bill.date >= pastWeek && bill.date <= current)],
		["本月", sum((bill) => bill.date.startsWith(current.slice(0, 7)))],
		[
			"本季度",
			sum(
				(bill) =>
					Number(bill.date.slice(0, 4)) === now.getFullYear() &&
					Math.floor((Number(bill.date.slice(5, 7)) - 1) / 3) ===
						Math.floor(now.getMonth() / 3),
			),
		],
		["近半年", sum((bill) => bill.date >= halfYear && bill.date <= current)],
		["本年", sum((bill) => bill.date.startsWith(String(now.getFullYear())))],
	] as [string, number][];
});
const monthly = $derived.by(() => {
	const groups = new Map<string, number>();
	for (const bill of expenses)
		groups.set(
			bill.date.slice(0, 7),
			(groups.get(bill.date.slice(0, 7)) ?? 0) + bill.amount_cents,
		);
	return [...groups].sort((left, right) => right[0].localeCompare(left[0]));
});

async function request(path: string, init?: RequestInit) {
	const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
		credentials: "include",
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	const data = await response.json();
	if (response.status === 401 && path !== "/auth/login") {
		authenticated = false;
		events = [];
		bills = [];
		dialog?.close();
		showDashboard([]);
	}
	if (!response.ok) throw new Error(data.error || "请求失败");
	return data;
}

function showDashboard(records: unknown[]) {
	const wrapper = document.querySelector<HTMLElement>("[data-private-content]");
	if (!wrapper) return;
	const dashboard = wrapper.querySelector<
		HTMLElement & { privateRecords?: unknown[] }
	>(
		mode === "events"
			? "[data-schedule-dashboard]"
			: "[data-billing-dashboard]",
	);
	if (dashboard) {
		dashboard.privateRecords = records;
		dashboard.dispatchEvent(
			new CustomEvent("private-hub:data", { detail: records }),
		);
	}
	wrapper.hidden = !authenticated;
}

async function refresh() {
	if (mode === "events") {
		events = await request("/events");
		showDashboard(events);
	} else {
		bills = await request("/bills");
		showDashboard(
			bills.map((bill) => ({
				id: bill.id,
				date: bill.date,
				time: "",
				category: bill.category,
				title: bill.note,
				type: bill.type,
				amount: bill.amount_cents / 100,
			})),
		);
	}
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
		authenticated = false;
		showDashboard([]);
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
		authenticated = false;
		showDashboard([]);
		error = cause instanceof Error ? cause.message : "登录失败";
	}
	busy = false;
}

async function logOut() {
	dialog?.close();
	authenticated = false;
	events = [];
	bills = [];
	showDashboard([]);
	try {
		await request("/auth/logout", { method: "POST" });
	} catch {
		/* Clear local data even when offline. */
	}
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

function editEvent(item: EventRecord) {
	editing = item.id;
	date = item.date;
	title = item.title;
	note = item.note;
	kind = item.kind;
	recurring = !!item.recurring;
	remind = !!item.remind;
	dialog?.scrollTo({ top: 0, behavior: "smooth" });
}

function editBill(item: BillRecord) {
	editing = item.id;
	date = item.date;
	note = item.note;
	amount = money(item.amount_cents);
	type = item.type;
	category = item.category;
	dialog?.scrollTo({ top: 0, behavior: "smooth" });
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
</script>

<section class="private-access">
	{#if loading}
		<p class="status">正在检查私密空间…</p>
	{:else if !apiBase}
		<div class="lock-card"><h2>私密空间尚未启用</h2><p>后端和数据库配置完成后才会开放，日历与账单数据不会写进公开页面。</p></div>
	{:else if !authenticated}
		<form class="lock-card" onsubmit={logIn}>
			<h2>仅自己可见</h2>
			<p>输入管理密码，解锁{mode === "events" ? "日历" : "账单"}。</p>
			<label>管理密码<input type="password" autocomplete="current-password" bind:value={password} required /></label>
			<button class="primary" type="submit" disabled={busy}>解锁空间</button>
		</form>
	{:else}
		<div class="access-actions">
			<span>私密模式已解锁</span>
			<button type="button" class="primary" onclick={() => { resetForm(); dialog.showModal(); }}>{mode === "events" ? "管理日历" : "记一笔 / 统计"}</button>
			<button type="button" class="secondary" onclick={logOut}>锁定</button>
		</div>
		<dialog bind:this={dialog} class="manage-dialog" onclose={resetForm}>
			<div class="dialog-heading"><h2>{mode === "events" ? "管理日历" : "账单管理"}</h2><button type="button" class="close" aria-label="关闭" onclick={() => dialog.close()}>×</button></div>
			{#if mode === "events"}
				<form class="entry-form" onsubmit={save}>
					<div class="form-row"><label>日期<input type="date" bind:value={date} required /></label><label>类型<select bind:value={kind}>{#each kinds as [value, label]}<option value={value}>{label}</option>{/each}</select></label></div>
					<label>名称<input type="text" maxlength="100" bind:value={title} placeholder="生日、纪念日或节假日" required /></label>
					<label>说明<textarea maxlength="1000" rows="3" bind:value={note} placeholder="写下想记住的事"></textarea></label>
					<div class="checks"><label><input type="checkbox" bind:checked={recurring} />每年重复</label><label><input type="checkbox" bind:checked={remind} />提前一天发邮件</label></div>
					<div class="form-actions"><button class="primary" type="submit" disabled={busy}>{editing ? "保存修改" : "添加日子"}</button>{#if editing}<button class="secondary" type="button" onclick={resetForm}>取消编辑</button>{/if}</div>
				</form>
				<h3>已记录的日子</h3>
				{#if !events.length}<p class="status">还没有记录。</p>{/if}
				<div class="record-list">{#each events as item (item.id)}<article><div><strong>{item.title}</strong><small>{item.date} · {kinds.find(([value]) => value === item.kind)?.[1] ?? "其他"}{item.recurring ? " · 每年" : ""}</small>{#if item.note}<p>{item.note}</p>{/if}</div><div class="record-actions"><button type="button" onclick={() => editEvent(item)}>编辑</button><button type="button" onclick={() => remove(item.id)}>删除</button></div></article>{/each}</div>
			{:else}
				<form class="entry-form" onsubmit={save}>
					<div class="form-row"><label>日期<input type="date" bind:value={date} required /></label><label>金额 ¥<input type="number" min="0.01" max="100000000" step="0.01" bind:value={amount} required /></label></div>
					<label>用途 / 说明<input type="text" maxlength="300" bind:value={note} placeholder="例如：午饭、地铁、DeepSeek API" required /></label>
					<div class="form-row"><label>类型<select bind:value={type}><option value="expense">支出</option><option value="income">收入</option></select></label><label>分类<select bind:value={category}>{#each categories as option}<option value={option}>{option === "auto" ? "AI 自动分类" : option}</option>{/each}</select></label></div>
					<div class="form-actions"><button class="primary" type="submit" disabled={busy}>{editing ? "保存修改" : "添加账单"}</button>{#if editing}<button class="secondary" type="button" onclick={resetForm}>取消编辑</button>{/if}</div>
				</form>
				<h3>支出速览</h3><div class="totals">{#each totals as [label, value]}<div><span>{label}</span><strong>¥{money(value)}</strong></div>{/each}</div>
				{#if monthly.length}<details><summary>每月花费</summary><div class="month-list">{#each monthly as [month, value]}<div><span>{month}</span><strong>¥{money(value)}</strong></div>{/each}</div></details>{/if}
				<h3>全部账单</h3>{#if !bills.length}<p class="status">还没有账单。</p>{/if}
				<div class="record-list">{#each bills as item (item.id)}<article><div><strong>{item.note}</strong><small>{item.date} · {item.category} · {item.type === "expense" ? "支出" : "收入"}</small></div><strong class="amount">{item.type === "expense" ? "−" : "+"}¥{money(item.amount_cents)}</strong><div class="record-actions"><button type="button" onclick={() => editBill(item)}>编辑</button><button type="button" onclick={() => remove(item.id)}>删除</button></div></article>{/each}</div>
			{/if}
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</dialog>
	{/if}
	{#if error && !authenticated}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.private-access{color:var(--deep-text,#222)}
	.status{color:#777}
	.lock-card{max-width:28rem;margin:2rem auto;padding:1.75rem;border:1.5px solid var(--deep-text,#29292d);border-radius:1rem;background:var(--card-bg,#fff);display:grid;gap:.8rem}
	.lock-card h2,.manage-dialog h2{margin:0;font-size:1.35rem;font-weight:800}
	.lock-card p{margin:0;color:#777;font-size:.85rem}
	.access-actions{display:flex;align-items:center;justify-content:flex-start;gap:.55rem;margin:0 0 .85rem;font-size:.72rem;color:#777}
	button{font:inherit;cursor:pointer}
	.primary,.secondary,.close,.record-actions button{border:1.5px solid var(--deep-text,#29292d);border-radius:.6rem;background:var(--card-bg,#fff);color:var(--deep-text,#222);padding:.5rem .8rem;font-size:.78rem;font-weight:750}
	.primary{background:#222;color:#fff}
	.primary:disabled{opacity:.55;cursor:wait}
	.close{font-size:1.4rem;line-height:1;padding:.2rem .55rem}
	.manage-dialog{inset:0;margin:auto;width:min(37rem,calc(100vw - 1.5rem));max-height:min(85vh,900px);overflow:auto;border:1.5px solid var(--deep-text,#29292d);border-radius:1rem;background:var(--card-bg,#fff);color:var(--deep-text,#222);padding:1.3rem;box-shadow:0 1rem 3rem rgb(0 0 0 / 20%)}
	.manage-dialog::backdrop{background:rgb(10 10 15 / 48%);backdrop-filter:blur(3px)}
	.dialog-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
	.manage-dialog h3{font-size:1rem;margin:1.5rem 0 .7rem}
	.entry-form{display:grid;gap:.75rem}
	.entry-form label,.lock-card label{display:grid;gap:.35rem;font-size:.78rem;font-weight:700}
	.entry-form input:not([type=checkbox]),.entry-form textarea,.entry-form select,.lock-card input{width:100%;min-height:2.5rem;box-sizing:border-box;border:1px solid #b8b8bd;border-radius:.55rem;background:var(--card-bg,#fff);color:var(--deep-text,#222);padding:.55rem .65rem;font:inherit}
	.entry-form textarea{resize:vertical}
	.form-row{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
	.checks,.form-actions{display:flex;gap:.8rem;flex-wrap:wrap;align-items:center}
	.checks label{display:flex;align-items:center;gap:.35rem;font-weight:500}
	.checks input{width:1rem;height:1rem}
	.record-list{display:grid;gap:.4rem}
	.record-list article{display:flex;align-items:center;gap:.6rem;border-bottom:1px solid #ddd;padding:.6rem 0;font-size:.78rem}
	.record-list article>div:first-child{min-width:0;flex:1}
	.record-list strong,.record-list small{display:block;overflow-wrap:anywhere}
	.record-list small{color:#777;margin-top:.18rem}
	.record-list p{margin:.3rem 0 0;white-space:pre-wrap}
	.record-actions{display:flex;gap:.3rem;flex:none}
	.record-actions button{border-color:#bbb;font-size:.7rem;padding:.3rem .5rem}
	.amount{white-space:nowrap}
	.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem}
	.totals>div{display:grid;gap:.1rem;padding:.55rem;border:1px solid #ddd;border-radius:.5rem}
	.totals span{font-size:.68rem;color:#777}
	.totals strong{font-size:.9rem}
	.month-list>div{display:flex;justify-content:space-between;padding:.4rem;border-bottom:1px solid #ddd;font-size:.76rem}
	.error{color:#b42346;background:#fff0f3;border:1px solid #e8a2b2;border-radius:.5rem;padding:.65rem;margin-top:.75rem;font-size:.8rem}
	button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #e75d8d;outline-offset:2px}
	@media(max-width:550px){.form-row{grid-template-columns:1fr}.totals{grid-template-columns:repeat(2,1fr)}.record-list article{flex-wrap:wrap}.record-actions{margin-left:auto}.manage-dialog{padding:1rem}.access-actions span{display:none}}
	@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
