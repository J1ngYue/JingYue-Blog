---
title: "Svelte 状态速记"
notebook: "learning"
slug: "svelte-state-notes"
published: 2026-07-31
description: "组件状态、派生值与副作用的边界。"
tags: ["Svelte", "前端"]
---

状态应该尽量接近使用它的地方。可以通过计算得到的值不重复保存，需要访问浏览器 API 的逻辑再放进客户端生命周期。

当状态需要跨页面持久化时，先明确它是用户偏好还是内容数据，再决定使用本地存储还是构建时内容。
